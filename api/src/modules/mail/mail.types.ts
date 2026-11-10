export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

// One email. Every module (auth today; invoices, receipts and reminders later) sends through IMailService.
export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  // Plain-text body for clients that don't show HTML; derived from the HTML when omitted.
  text?: string;
  cc?: string | string[];
  replyTo?: string;
  attachments?: MailAttachment[];
  // Shown as the sender name instead of the product name (e.g. the shop sending its invoice).
  fromName?: string;
}

// How a message actually leaves the server. SMTP in production; the log locally and in tests.
export interface MailTransport {
  readonly name: string;
  deliver(message: MailMessage & { from: string }): Promise<void>;
}

// A ready-made email: what the templates in mail.templates.ts return.
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}
