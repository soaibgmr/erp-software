import { inject, injectable } from "inversify";
import { milliToDecimal, priceCart, supplyTypeFor, toMilli, toPaise } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { hasPermission, type AuthContext } from "../../common/auth-context";
import { fieldErrors, notFound } from "../../common/http-error";
import type { IBranchRepository } from "../branches/interfaces/ibranch.repository";
import type { ICustomerRepository } from "../customers/interfaces/icustomer.repository";
import type { ISettingsService } from "../settings/interfaces/isettings.service";
import type { IInvoiceRepository } from "./interfaces/iinvoice.repository";
import type { ICartPricer } from "./interfaces/iinvoice.service";
import type { CustomerCredit, PricedCartResult, PricedLine, QuoteDto, QuoteDtoInput } from "./invoice.types";

const rupees = (paise: number) => (paise / 100).toFixed(2);

@injectable()
export class CartPricer implements ICartPricer {
  constructor(
    @inject(TYPES.InvoiceRepository) private readonly invoices: IInvoiceRepository,
    @inject(TYPES.CustomerRepository) private readonly customers: ICustomerRepository,
    @inject(TYPES.BranchRepository) private readonly branches: IBranchRepository,
    @inject(TYPES.SettingsService) private readonly settings: ISettingsService,
  ) {}

  async customerCredit(auth: AuthContext, customerId: string): Promise<CustomerCredit> {
    const c = await this.customers.findById(auth.businessId, customerId);
    if (!c) throw notFound("Customer not found");
    const outstanding = await this.invoices.customerOutstanding(customerId);
    const limit = toPaise(c.creditLimit);
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      gstin: c.gstin,
      address: [c.address, c.city, c.pincode].filter(Boolean).join(", ") || null,
      stateCode: c.stateCode,
      creditLimit: c.creditLimit,
      creditDays: c.creditDays,
      outstanding: rupees(outstanding),
      availableCredit: rupees(Math.max(limit - outstanding, 0)),
    };
  }

  async price(auth: AuthContext, branchId: string, input: QuoteDtoInput): Promise<PricedCartResult> {
    const branch = await this.branches.findById(auth.businessId, branchId);
    if (!branch) throw notFound("Branch not found");
    const customer = input.customerId ? await this.customerCredit(auth, input.customerId).catch(() => null) : null;
    if (input.customerId && !customer) throw fieldErrors([{ path: "customerId", message: "Customer not found" }]);

    const itemIds = input.lines.flatMap((l) => (l.kind === "ITEM" ? [l.itemId] : []));
    const labourIds = input.lines.flatMap((l) => (l.kind === "LABOUR" ? [l.labourServiceId] : []));
    const [items, labour, pos] = await Promise.all([
      this.invoices.findSaleItems(auth.businessId, itemIds, branchId),
      this.invoices.findSaleLabour(auth.businessId, labourIds),
      this.settings.get(auth.businessId, "pos"),
    ]);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const labourById = new Map(labour.map((l) => [l.id, l]));

    // Resolve every line to master data; unknown or inactive lines are field errors on that line.
    const issues: { path: string; message: string }[] = [];
    const resolved = input.lines.map((l, i) => {
      if (l.kind === "ITEM") {
        const item = itemById.get(l.itemId);
        if (!item) issues.push({ path: `lines.${i}.itemId`, message: "Item not found" });
        else if (!item.isActive) issues.push({ path: `lines.${i}.itemId`, message: `${item.name} is inactive` });
        return (
          item && {
            kind: "ITEM" as const,
            itemId: item.id,
            labourServiceId: null,
            description: item.name,
            sku: item.sku,
            hsnSac: item.hsnCode,
            unit: item.unit,
            rate: item.salePrice,
            gstRate: item.gstRate,
            taxInclusive: item.taxInclusive,
            unitCost: item.purchasePrice,
            available: item.available ?? 0,
            quantity: l.quantity,
            discount: l.discount,
          }
        );
      }
      const svc = labourById.get(l.labourServiceId);
      if (!svc) issues.push({ path: `lines.${i}.labourServiceId`, message: "Labour service not found" });
      else if (!svc.isActive) issues.push({ path: `lines.${i}.labourServiceId`, message: `${svc.name} is inactive` });
      return (
        svc && {
          kind: "LABOUR" as const,
          itemId: null,
          labourServiceId: svc.id,
          description: svc.name,
          sku: null,
          hsnSac: svc.sacCode,
          unit: "SVC",
          rate: svc.rate,
          gstRate: svc.gstRate,
          taxInclusive: false,
          unitCost: null,
          available: null,
          quantity: l.quantity,
          discount: l.discount,
        }
      );
    });
    if (issues.length) throw fieldErrors(issues);
    const lines = resolved.map((r) => r!);

    // B2C counter sales are local; a customer with another state's place of supply pays IGST.
    const placeOfSupply = customer?.stateCode ?? (customer?.gstin ? customer.gstin.slice(0, 2) : branch.stateCode);
    const supplyType = supplyTypeFor(branch.stateCode, placeOfSupply);
    const priced = priceCart(lines, input.billDiscount ?? null, supplyType);

    const pricedLines: PricedLine[] = lines.map((l, i) => {
      const p = priced.lines[i]!;
      return {
        kind: l.kind,
        itemId: l.itemId,
        labourServiceId: l.labourServiceId,
        description: l.description,
        sku: l.sku,
        hsnSac: l.hsnSac,
        unit: l.unit,
        quantity: l.quantity,
        rate: l.rate,
        taxInclusive: l.taxInclusive,
        gstRate: l.gstRate,
        unitCost: l.unitCost,
        lineDiscountPaise: p.lineDiscountPaise,
        billDiscountPaise: p.billDiscountPaise,
        taxablePaise: p.taxablePaise,
        cgstPaise: p.cgstPaise,
        sgstPaise: p.sgstPaise,
        igstPaise: p.igstPaise,
        totalPaise: p.totalPaise,
        available: l.available,
      };
    });

    const maxDiscountPercent = pos.maxDiscountPercent;
    const quote: QuoteDto = {
      supplyType,
      placeOfSupply,
      customer,
      lines: pricedLines.map((l) => ({
        kind: l.kind,
        itemId: l.itemId,
        labourServiceId: l.labourServiceId,
        description: l.description,
        sku: l.sku,
        hsnSac: l.hsnSac,
        unit: l.unit,
        quantity: milliToDecimal(toMilli(l.quantity)),
        rate: l.rate.toFixed(2),
        gstRate: l.gstRate,
        taxInclusive: l.taxInclusive,
        discount: rupees(l.lineDiscountPaise + l.billDiscountPaise),
        taxable: rupees(l.taxablePaise),
        tax: rupees(l.cgstPaise + l.sgstPaise + l.igstPaise),
        total: rupees(l.totalPaise),
        available: l.available == null ? null : milliToDecimal(toMilli(l.available)),
        stockStatus: l.available == null ? null : l.available <= 0 ? "OUT" : "IN_STOCK",
      })),
      itemCount: lines.length,
      gross: rupees(priced.grossPaise),
      lineDiscount: rupees(priced.lineDiscountPaise),
      billDiscount: rupees(priced.billDiscountPaise),
      discount: rupees(priced.discountPaise),
      discountPercent: priced.discountBasisPoints / 100,
      taxable: rupees(priced.taxablePaise),
      cgst: rupees(priced.cgstPaise),
      sgst: rupees(priced.sgstPaise),
      igst: rupees(priced.igstPaise),
      tax: rupees(priced.taxPaise),
      roundOff: rupees(priced.roundOffPaise),
      total: rupees(priced.totalPaise),
      maxDiscountPercent,
      needsDiscountApproval:
        priced.discountBasisPoints > Math.round(maxDiscountPercent * 100) && !hasPermission(auth, "discount.override"),
      issues: priced.issues,
    };

    return {
      quote,
      lines: pricedLines,
      totals: {
        grossPaise: priced.grossPaise,
        discountPaise: priced.discountPaise,
        discountBasisPoints: priced.discountBasisPoints,
        taxablePaise: priced.taxablePaise,
        cgstPaise: priced.cgstPaise,
        sgstPaise: priced.sgstPaise,
        igstPaise: priced.igstPaise,
        roundOffPaise: priced.roundOffPaise,
        totalPaise: priced.totalPaise,
      },
      customer,
      placeOfSupply,
      supplyType,
    };
  }
}
