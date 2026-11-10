import { inject, injectable } from "inversify";
import { PAYMENT_METHODS, toPaise, type PaymentMethod } from "@erp-software/shared";
import { TYPES } from "../../config/ioc.types";
import { canAccessBranch, hasPermission, type AuthContext } from "../../common/auth-context";
import { conflict, forbidden, notFound } from "../../common/http-error";
import type { Paginated } from "../../common/pagination";
import type { IAuditService } from "../audit/interfaces/iaudit.service";
import type { IShiftRepository } from "./interfaces/ishift.repository";
import type { IShiftService } from "./interfaces/ishift.service";
import type {
  CloseShiftDto,
  ListShiftsQuery,
  OpenShiftDto,
  ShiftDto,
  ShiftMethodLine,
  ShiftReportDto,
  ShiftRow,
} from "./shift.types";

const rupees = (paise: number) => (paise / 100).toFixed(2);

const toDto = ({ userId: _userId, counted: _counted, ...r }: ShiftRow): ShiftDto => r;

@injectable()
export class ShiftService implements IShiftService {
  constructor(
    @inject(TYPES.ShiftRepository) private readonly shifts: IShiftRepository,
    @inject(TYPES.AuditService) private readonly audit: IAuditService,
  ) {}

  async current(auth: AuthContext, branchId: string): Promise<ShiftReportDto | null> {
    const shift = await this.shifts.findOpen(branchId, auth.userId);
    return shift && this.buildReport(shift);
  }

  findOpenId(branchId: string, userId: string): Promise<string | null> {
    return this.shifts.findOpen(branchId, userId).then((s) => s?.id ?? null);
  }

  async open(auth: AuthContext, branchId: string, input: OpenShiftDto): Promise<ShiftReportDto> {
    if (await this.shifts.findOpen(branchId, auth.userId))
      throw conflict("You already have an open shift in this branch");
    const shift = await this.shifts.create({
      branchId,
      userId: auth.userId,
      counter: input.counter,
      openingCash: input.openingCash.toFixed(2),
    });
    await this.audit.record(auth, {
      action: "shift.open",
      entity: "Shift",
      entityId: shift.id,
      branchId,
      after: { counter: shift.counter, openingCash: shift.openingCash },
    });
    return this.buildReport(shift);
  }

  async close(auth: AuthContext, branchId: string, id: string, input: CloseShiftDto): Promise<ShiftReportDto> {
    const shift = await this.shifts.findById(id);
    if (!shift || shift.branchId !== branchId) throw notFound("Shift not found");
    // Cashiers close their own shift; a manager with the dashboard/report permission can close anyone's.
    if (shift.userId !== auth.userId && !hasPermission(auth, "report.view"))
      throw forbidden("You can only close your own shift");
    if (shift.status !== "OPEN") throw conflict("This shift is already closed");

    const report = await this.buildReport(shift);
    const expected = Object.fromEntries(report.methods.map((m) => [m.mode, m.expected]));
    const counted = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, (input.counted[m] ?? 0).toFixed(2)]));
    if (!(await this.shifts.close(id, { counted, expected, note: input.note ?? null })))
      throw conflict("This shift is already closed");

    const variance = Object.fromEntries(
      PAYMENT_METHODS.map((m) => [m, rupees(toPaise(counted[m]!) - toPaise(expected[m] ?? "0"))]),
    );
    await this.audit.record(auth, {
      action: "shift.close",
      entity: "Shift",
      entityId: id,
      branchId,
      after: { expected, counted, variance, note: input.note ?? null },
    });
    return this.report(auth, id);
  }

  async report(auth: AuthContext, id: string): Promise<ShiftReportDto> {
    const shift = await this.shifts.findById(id);
    if (!shift || !canAccessBranch(auth, shift.branchId)) throw notFound("Shift not found");
    if (shift.userId !== auth.userId && !hasPermission(auth, "report.view"))
      throw forbidden("You can only see your own shifts");
    return this.buildReport(shift);
  }

  async list(auth: AuthContext, branchId: string, query: ListShiftsQuery): Promise<Paginated<ShiftDto>> {
    const page = await this.shifts.list(branchId, query);
    // Cashiers see their own shifts only.
    const rows = hasPermission(auth, "report.view") ? page.data : page.data.filter((s) => s.userId === auth.userId);
    return { ...page, data: rows.map(toDto) };
  }

  private async buildReport(shift: ShiftRow): Promise<ShiftReportDto> {
    const [payments, stats] = await Promise.all([
      this.shifts.paymentTotals(shift.id),
      this.shifts.invoiceStats(shift.id),
    ]);
    const methods: ShiftMethodLine[] = PAYMENT_METHODS.map((mode: PaymentMethod) => {
      const taken = payments.find((p) => p.mode === mode)?.amountPaise ?? 0;
      const expected = taken + (mode === "CASH" ? toPaise(shift.openingCash) : 0);
      const counted = shift.counted?.[mode];
      return {
        mode,
        expected: rupees(expected),
        counted: counted ?? null,
        variance: counted == null ? null : rupees(toPaise(counted) - expected),
      };
    });
    return {
      ...toDto(shift),
      methods,
      invoiceCount: stats.count,
      salesTotal: rupees(stats.totalPaise),
      cancelledCount: stats.cancelledCount,
      creditTotal: rupees(stats.creditPaise),
    };
  }
}
