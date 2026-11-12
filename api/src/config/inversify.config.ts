import { Container } from "inversify";
import type { PrismaClient } from "@prisma/client";
import { TYPES } from "./ioc.types";
import { prisma } from "./database";

// Middleware
import { AuthMiddleware } from "../middleware/auth";

// Users & auth
import type { IUserRepository } from "../modules/users/interfaces/iuser.repository";
import type { IRefreshTokenRepository } from "../modules/users/interfaces/irefresh-token.repository";
import type { IUserService } from "../modules/users/interfaces/iuser.service";
import { UserRepository } from "../modules/users/user.repository";
import { RefreshTokenRepository } from "../modules/users/refresh-token.repository";
import { UserService } from "../modules/users/user.service";
import type { IAuthTokenRepository } from "../modules/users/interfaces/iauth-token.repository";
import type { IAccountService } from "../modules/users/interfaces/iaccount.service";
import { AuthTokenRepository } from "../modules/users/auth-token.repository";
import { AccountService } from "../modules/users/account.service";
import type { IMailService } from "../modules/mail/interfaces/imail.service";
import { MailService } from "../modules/mail/mail.service";
import type { IPlatformRepository } from "../modules/platform/interfaces/iplatform.repository";
import type { IPlatformService } from "../modules/platform/interfaces/iplatform.service";
import { PlatformRepository } from "../modules/platform/platform.repository";
import { PlatformService } from "../modules/platform/platform.service";
import { PlatformController } from "../modules/platform/platform.controller";
import { PlatformAuthMiddleware } from "../middleware/platform-auth";
import { UserController } from "../modules/users/user.controller";

// Roles
import type { IRoleRepository } from "../modules/roles/interfaces/irole.repository";
import type { IRoleService } from "../modules/roles/interfaces/irole.service";
import { RoleRepository } from "../modules/roles/role.repository";
import { RoleService } from "../modules/roles/role.service";
import { RoleController } from "../modules/roles/role.controller";

// Branches
import type { IBranchRepository } from "../modules/branches/interfaces/ibranch.repository";
import type { IBranchService } from "../modules/branches/interfaces/ibranch.service";
import { BranchRepository } from "../modules/branches/branch.repository";
import { BranchService } from "../modules/branches/branch.service";
import { BranchController } from "../modules/branches/branch.controller";

// Business profile
import type { IBusinessRepository } from "../modules/business/interfaces/ibusiness.repository";
import type { IBusinessService } from "../modules/business/interfaces/ibusiness.service";
import { BusinessRepository } from "../modules/business/business.repository";
import { BusinessService } from "../modules/business/business.service";
import { BusinessController } from "../modules/business/business.controller";

// Settings
import type { ISettingsRepository } from "../modules/settings/interfaces/isettings.repository";
import type { ISettingsService } from "../modules/settings/interfaces/isettings.service";
import { SettingsRepository } from "../modules/settings/settings.repository";
import { SettingsService } from "../modules/settings/settings.service";
import { SettingsController } from "../modules/settings/settings.controller";

// Number series
import type { IDocumentSequenceRepository } from "../modules/document-sequences/interfaces/idocument-sequence.repository";
import type { IDocumentSequenceService } from "../modules/document-sequences/interfaces/idocument-sequence.service";
import { DocumentSequenceRepository } from "../modules/document-sequences/document-sequence.repository";
import { DocumentSequenceService } from "../modules/document-sequences/document-sequence.service";
import { DocumentSequenceController } from "../modules/document-sequences/document-sequence.controller";

// Customers
import type { ICustomerRepository } from "../modules/customers/interfaces/icustomer.repository";
import type { ICustomerService } from "../modules/customers/interfaces/icustomer.service";
import { CustomerRepository } from "../modules/customers/customer.repository";
import { CustomerService } from "../modules/customers/customer.service";
import { CustomerController } from "../modules/customers/customer.controller";

// Audit
import type { IAuditRepository } from "../modules/audit/interfaces/iaudit.repository";
import type { IAuditService } from "../modules/audit/interfaces/iaudit.service";
import { AuditRepository } from "../modules/audit/audit.repository";
import { AuditService } from "../modules/audit/audit.service";
import { AuditController } from "../modules/audit/audit.controller";

// Unit of work
import { PrismaUnitOfWork, type IUnitOfWork } from "../common/unit-of-work";
import { PrismaAttemptLimiter, type IAttemptLimiter } from "../common/attempt-limiter";

// Catalog masters
import type { ICatalogRepository } from "../modules/catalog/interfaces/icatalog.repository";
import type { ICatalogService } from "../modules/catalog/interfaces/icatalog.service";
import { CatalogRepository } from "../modules/catalog/catalog.repository";
import { CatalogService } from "../modules/catalog/catalog.service";
import { CatalogController } from "../modules/catalog/catalog.controller";

// Items
import type { IItemRepository } from "../modules/items/interfaces/iitem.repository";
import type { IItemService } from "../modules/items/interfaces/iitem.service";
import { ItemRepository } from "../modules/items/item.repository";
import { ItemService } from "../modules/items/item.service";
import { ItemController } from "../modules/items/item.controller";

// Labour services
import type { ILabourServiceRepository } from "../modules/labour-services/interfaces/ilabour-service.repository";
import type { ILabourServiceService } from "../modules/labour-services/interfaces/ilabour-service.service";
import { LabourServiceRepository } from "../modules/labour-services/labour-service.repository";
import { LabourServiceService } from "../modules/labour-services/labour-service.service";
import { LabourServiceController } from "../modules/labour-services/labour-service.controller";

// Stock
import type { IStockRepository } from "../modules/stock/interfaces/istock.repository";
import type { IStockDocumentRepository } from "../modules/stock/interfaces/istock-document.repository";
import type {
  IStockAdjustmentService,
  IStockImportService,
  IStockService,
  IStockTransferService,
} from "../modules/stock/interfaces/istock.service";
import { StockRepository } from "../modules/stock/stock.repository";
import { StockDocumentRepository } from "../modules/stock/stock-document.repository";
import { StockService } from "../modules/stock/stock.service";
import { StockAdjustmentService } from "../modules/stock/stock-adjustment.service";
import { StockTransferService } from "../modules/stock/stock-transfer.service";
import { StockImportService } from "../modules/stock/stock-import.service";
import { StockController } from "../modules/stock/stock.controller";

// Shifts
import type { IShiftRepository } from "../modules/shifts/interfaces/ishift.repository";
import type { IShiftService } from "../modules/shifts/interfaces/ishift.service";
import { ShiftRepository } from "../modules/shifts/shift.repository";
import { ShiftService } from "../modules/shifts/shift.service";
import { ShiftController } from "../modules/shifts/shift.controller";

// POS
import type { IHeldCartRepository } from "../modules/pos/interfaces/iheld-cart.repository";
import type { IPosService } from "../modules/pos/interfaces/ipos.service";
import { HeldCartRepository } from "../modules/pos/held-cart.repository";
import { PosService } from "../modules/pos/pos.service";
import { PosController } from "../modules/pos/pos.controller";
import type { IPosScannerRepository } from "../modules/pos-scanner/interfaces/ipos-scanner.repository";
import type { IPosScannerService } from "../modules/pos-scanner/interfaces/ipos-scanner.service";
import { PosScannerRepository } from "../modules/pos-scanner/pos-scanner.repository";
import { PosScannerService } from "../modules/pos-scanner/pos-scanner.service";
import { PosScannerController } from "../modules/pos-scanner/pos-scanner.controller";

// Invoices
import type { IInvoiceRepository } from "../modules/invoices/interfaces/iinvoice.repository";
import type {
  ICartPricer,
  ICreditNoteService,
  IInvoiceMailer,
  IInvoicePostingService,
  IInvoiceService,
  IOpeningBalanceService,
  IPaymentService,
} from "../modules/invoices/interfaces/iinvoice.service";
import { InvoiceRepository } from "../modules/invoices/invoice.repository";
import { CartPricer } from "../modules/invoices/cart-pricer.service";
import { InvoiceService } from "../modules/invoices/invoice.service";
import { InvoicePostingService } from "../modules/invoices/invoice-posting.service";
import { InvoiceMailer } from "../modules/invoices/invoice-mailer.service";
import { PaymentService } from "../modules/invoices/payment.service";
import { OpeningBalanceService } from "../modules/invoices/opening-balance.service";
import { CreditNoteService } from "../modules/invoices/credit-note.service";
import { InvoiceController } from "../modules/invoices/invoice.controller";

// Dashboard and reports
import type { IReportRepository } from "../modules/reports/interfaces/ireport.repository";
import type { IReportService } from "../modules/reports/interfaces/ireport.service";
import { ReportRepository } from "../modules/reports/report.repository";
import { ReportService } from "../modules/reports/report.service";
import { ReportController } from "../modules/reports/report.controller";
import type { IDashboardRepository } from "../modules/dashboard/interfaces/idashboard.repository";
import type { IDashboardService } from "../modules/dashboard/interfaces/idashboard.service";
import { DashboardRepository } from "../modules/dashboard/dashboard.repository";
import { DashboardService } from "../modules/dashboard/dashboard.service";
import { DashboardController } from "../modules/dashboard/dashboard.controller";

const container = new Container();

container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
container.bind<IUnitOfWork>(TYPES.UnitOfWork).to(PrismaUnitOfWork).inSingletonScope();
container.bind<IAttemptLimiter>(TYPES.AttemptLimiter).to(PrismaAttemptLimiter).inSingletonScope();

// Middleware
container.bind<AuthMiddleware>(TYPES.AuthMiddleware).to(AuthMiddleware).inSingletonScope();

// Repositories
container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository).inSingletonScope();
container.bind<IRefreshTokenRepository>(TYPES.RefreshTokenRepository).to(RefreshTokenRepository).inSingletonScope();
container.bind<IRoleRepository>(TYPES.RoleRepository).to(RoleRepository).inSingletonScope();
container.bind<IBranchRepository>(TYPES.BranchRepository).to(BranchRepository).inSingletonScope();
container.bind<IBusinessRepository>(TYPES.BusinessRepository).to(BusinessRepository).inSingletonScope();
container.bind<ISettingsRepository>(TYPES.SettingsRepository).to(SettingsRepository).inSingletonScope();
container
  .bind<IDocumentSequenceRepository>(TYPES.DocumentSequenceRepository)
  .to(DocumentSequenceRepository)
  .inSingletonScope();
container.bind<ICustomerRepository>(TYPES.CustomerRepository).to(CustomerRepository).inSingletonScope();
container.bind<IAuditRepository>(TYPES.AuditRepository).to(AuditRepository).inSingletonScope();
container.bind<ICatalogRepository>(TYPES.CatalogRepository).to(CatalogRepository).inSingletonScope();
container.bind<IItemRepository>(TYPES.ItemRepository).to(ItemRepository).inSingletonScope();
container.bind<ILabourServiceRepository>(TYPES.LabourServiceRepository).to(LabourServiceRepository).inSingletonScope();
container.bind<IStockRepository>(TYPES.StockRepository).to(StockRepository).inSingletonScope();
container.bind<IStockDocumentRepository>(TYPES.StockDocumentRepository).to(StockDocumentRepository).inSingletonScope();
container.bind<IShiftRepository>(TYPES.ShiftRepository).to(ShiftRepository).inSingletonScope();
container.bind<IHeldCartRepository>(TYPES.HeldCartRepository).to(HeldCartRepository).inSingletonScope();
container.bind<IPosScannerRepository>(TYPES.PosScannerRepository).to(PosScannerRepository).inSingletonScope();
container.bind<IInvoiceRepository>(TYPES.InvoiceRepository).to(InvoiceRepository).inSingletonScope();

// Services
container.bind<IUserService>(TYPES.UserService).to(UserService).inSingletonScope();
container.bind<IAuthTokenRepository>(TYPES.AuthTokenRepository).to(AuthTokenRepository).inSingletonScope();
container.bind<IAccountService>(TYPES.AccountService).to(AccountService).inSingletonScope();
container.bind<IMailService>(TYPES.MailService).to(MailService).inSingletonScope();
container.bind<IPlatformRepository>(TYPES.PlatformRepository).to(PlatformRepository).inSingletonScope();
container.bind<IPlatformService>(TYPES.PlatformService).to(PlatformService).inSingletonScope();
container.bind<PlatformController>(TYPES.PlatformController).to(PlatformController).inSingletonScope();
container.bind<PlatformAuthMiddleware>(TYPES.PlatformAuthMiddleware).to(PlatformAuthMiddleware).inSingletonScope();
container.bind<IRoleService>(TYPES.RoleService).to(RoleService).inSingletonScope();
container.bind<IBranchService>(TYPES.BranchService).to(BranchService).inSingletonScope();
container.bind<IBusinessService>(TYPES.BusinessService).to(BusinessService).inSingletonScope();
container.bind<ISettingsService>(TYPES.SettingsService).to(SettingsService).inSingletonScope();
container.bind<IDocumentSequenceService>(TYPES.DocumentSequenceService).to(DocumentSequenceService).inSingletonScope();
container.bind<ICustomerService>(TYPES.CustomerService).to(CustomerService).inSingletonScope();
container.bind<IAuditService>(TYPES.AuditService).to(AuditService).inSingletonScope();
container.bind<ICatalogService>(TYPES.CatalogService).to(CatalogService).inSingletonScope();
container.bind<IItemService>(TYPES.ItemService).to(ItemService).inSingletonScope();
container.bind<ILabourServiceService>(TYPES.LabourServiceService).to(LabourServiceService).inSingletonScope();
container.bind<IStockService>(TYPES.StockService).to(StockService).inSingletonScope();
container.bind<IStockAdjustmentService>(TYPES.StockAdjustmentService).to(StockAdjustmentService).inSingletonScope();
container.bind<IStockTransferService>(TYPES.StockTransferService).to(StockTransferService).inSingletonScope();
container.bind<IStockImportService>(TYPES.StockImportService).to(StockImportService).inSingletonScope();
container.bind<IShiftService>(TYPES.ShiftService).to(ShiftService).inSingletonScope();
container.bind<ICartPricer>(TYPES.CartPricer).to(CartPricer).inSingletonScope();
container.bind<IPosService>(TYPES.PosService).to(PosService).inSingletonScope();
container.bind<IPosScannerService>(TYPES.PosScannerService).to(PosScannerService).inSingletonScope();
container.bind<IInvoiceService>(TYPES.InvoiceService).to(InvoiceService).inSingletonScope();
container.bind<IInvoicePostingService>(TYPES.InvoicePostingService).to(InvoicePostingService).inSingletonScope();
container.bind<IInvoiceMailer>(TYPES.InvoiceMailer).to(InvoiceMailer).inSingletonScope();
container.bind<IPaymentService>(TYPES.PaymentService).to(PaymentService).inSingletonScope();
container.bind<IOpeningBalanceService>(TYPES.OpeningBalanceService).to(OpeningBalanceService).inSingletonScope();
container.bind<ICreditNoteService>(TYPES.CreditNoteService).to(CreditNoteService).inSingletonScope();

// Controllers
container.bind<UserController>(TYPES.UserController).to(UserController).inSingletonScope();
container.bind<RoleController>(TYPES.RoleController).to(RoleController).inSingletonScope();
container.bind<BranchController>(TYPES.BranchController).to(BranchController).inSingletonScope();
container.bind<BusinessController>(TYPES.BusinessController).to(BusinessController).inSingletonScope();
container.bind<SettingsController>(TYPES.SettingsController).to(SettingsController).inSingletonScope();
container
  .bind<DocumentSequenceController>(TYPES.DocumentSequenceController)
  .to(DocumentSequenceController)
  .inSingletonScope();
container.bind<CustomerController>(TYPES.CustomerController).to(CustomerController).inSingletonScope();
container.bind<AuditController>(TYPES.AuditController).to(AuditController).inSingletonScope();
container.bind<CatalogController>(TYPES.CatalogController).to(CatalogController).inSingletonScope();
container.bind<ItemController>(TYPES.ItemController).to(ItemController).inSingletonScope();
container.bind<LabourServiceController>(TYPES.LabourServiceController).to(LabourServiceController).inSingletonScope();
container.bind<StockController>(TYPES.StockController).to(StockController).inSingletonScope();
container.bind<ShiftController>(TYPES.ShiftController).to(ShiftController).inSingletonScope();
container.bind<PosController>(TYPES.PosController).to(PosController).inSingletonScope();
container.bind<PosScannerController>(TYPES.PosScannerController).to(PosScannerController).inSingletonScope();
container.bind<InvoiceController>(TYPES.InvoiceController).to(InvoiceController).inSingletonScope();

container.bind<IReportRepository>(TYPES.ReportRepository).to(ReportRepository).inSingletonScope();
container.bind<IReportService>(TYPES.ReportService).to(ReportService).inSingletonScope();
container.bind<ReportController>(TYPES.ReportController).to(ReportController).inSingletonScope();
container.bind<IDashboardRepository>(TYPES.DashboardRepository).to(DashboardRepository).inSingletonScope();
container.bind<IDashboardService>(TYPES.DashboardService).to(DashboardService).inSingletonScope();
container.bind<DashboardController>(TYPES.DashboardController).to(DashboardController).inSingletonScope();

export { container };
