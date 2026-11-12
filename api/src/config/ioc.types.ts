export const TYPES = {
  PrismaClient: Symbol.for("PrismaClient"),
  UnitOfWork: Symbol.for("UnitOfWork"),
  AttemptLimiter: Symbol.for("AttemptLimiter"),

  // Middleware
  AuthMiddleware: Symbol.for("AuthMiddleware"),

  // Users & auth
  UserRepository: Symbol.for("UserRepository"),
  RefreshTokenRepository: Symbol.for("RefreshTokenRepository"),
  UserService: Symbol.for("UserService"),
  UserController: Symbol.for("UserController"),
  AuthTokenRepository: Symbol.for("AuthTokenRepository"),
  AccountService: Symbol.for("AccountService"),

  // Email (shared by every module)
  MailService: Symbol.for("MailService"),

  // Platform admin (approves shops)
  PlatformRepository: Symbol.for("PlatformRepository"),
  PlatformService: Symbol.for("PlatformService"),
  PlatformController: Symbol.for("PlatformController"),
  PlatformAuthMiddleware: Symbol.for("PlatformAuthMiddleware"),

  // Roles
  RoleRepository: Symbol.for("RoleRepository"),
  RoleService: Symbol.for("RoleService"),
  RoleController: Symbol.for("RoleController"),

  // Branches
  BranchRepository: Symbol.for("BranchRepository"),
  BranchService: Symbol.for("BranchService"),
  BranchController: Symbol.for("BranchController"),

  // Business profile
  BusinessRepository: Symbol.for("BusinessRepository"),
  BusinessService: Symbol.for("BusinessService"),
  BusinessController: Symbol.for("BusinessController"),

  // Settings
  SettingsRepository: Symbol.for("SettingsRepository"),
  SettingsService: Symbol.for("SettingsService"),
  SettingsController: Symbol.for("SettingsController"),

  // Number series
  DocumentSequenceRepository: Symbol.for("DocumentSequenceRepository"),
  DocumentSequenceService: Symbol.for("DocumentSequenceService"),
  DocumentSequenceController: Symbol.for("DocumentSequenceController"),

  // Customers
  CustomerRepository: Symbol.for("CustomerRepository"),
  CustomerService: Symbol.for("CustomerService"),
  CustomerController: Symbol.for("CustomerController"),

  // Audit
  AuditRepository: Symbol.for("AuditRepository"),
  AuditService: Symbol.for("AuditService"),
  AuditController: Symbol.for("AuditController"),

  // Catalog masters (categories, brands, HSN/SAC, vehicle makes and models)
  CatalogRepository: Symbol.for("CatalogRepository"),
  CatalogService: Symbol.for("CatalogService"),
  CatalogController: Symbol.for("CatalogController"),

  // Items
  ItemRepository: Symbol.for("ItemRepository"),
  ItemService: Symbol.for("ItemService"),
  ItemController: Symbol.for("ItemController"),

  // Labour services
  LabourServiceRepository: Symbol.for("LabourServiceRepository"),
  LabourServiceService: Symbol.for("LabourServiceService"),
  LabourServiceController: Symbol.for("LabourServiceController"),

  // Stock
  StockRepository: Symbol.for("StockRepository"),
  StockDocumentRepository: Symbol.for("StockDocumentRepository"),
  StockService: Symbol.for("StockService"),
  StockAdjustmentService: Symbol.for("StockAdjustmentService"),
  StockTransferService: Symbol.for("StockTransferService"),
  StockImportService: Symbol.for("StockImportService"),
  StockController: Symbol.for("StockController"),

  // Shifts
  ShiftRepository: Symbol.for("ShiftRepository"),
  ShiftService: Symbol.for("ShiftService"),
  ShiftController: Symbol.for("ShiftController"),

  // POS (quote, held carts)
  HeldCartRepository: Symbol.for("HeldCartRepository"),
  PosService: Symbol.for("PosService"),
  PosController: Symbol.for("PosController"),

  // Phone as a barcode scanner for the POS
  PosScannerRepository: Symbol.for("PosScannerRepository"),
  PosScannerService: Symbol.for("PosScannerService"),
  PosScannerController: Symbol.for("PosScannerController"),

  // Invoices, payments, credit notes
  InvoiceRepository: Symbol.for("InvoiceRepository"),
  CartPricer: Symbol.for("CartPricer"),
  InvoiceService: Symbol.for("InvoiceService"),
  InvoicePostingService: Symbol.for("InvoicePostingService"),
  InvoiceMailer: Symbol.for("InvoiceMailer"),
  PaymentService: Symbol.for("PaymentService"),
  OpeningBalanceService: Symbol.for("OpeningBalanceService"),
  CreditNoteService: Symbol.for("CreditNoteService"),
  InvoiceController: Symbol.for("InvoiceController"),

  // Dashboard and reports
  ReportRepository: Symbol.for("ReportRepository"),
  ReportService: Symbol.for("ReportService"),
  ReportController: Symbol.for("ReportController"),
  DashboardRepository: Symbol.for("DashboardRepository"),
  DashboardService: Symbol.for("DashboardService"),
  DashboardController: Symbol.for("DashboardController"),
} as const;
