import type { MailMessage } from "../mail.types";

export interface IMailService {
  // Sends now; throws when the transport fails. Use it when the caller must know (e.g. "Email invoice" button).
  send(message: MailMessage): Promise<void>;
  // Sends without failing the caller: errors are logged. Use it for notices that must not block the
  // action that triggered them (sign-up, approval, password reset).
  sendQuietly(message: MailMessage): Promise<void>;
}
