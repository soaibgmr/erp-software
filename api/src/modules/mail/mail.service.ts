import { injectable } from "inversify";
import nodemailer, { type Transporter } from "nodemailer";
import { env, isProduction } from "../../config/env";
import { logger } from "../../config/logger";
import type { IMailService } from "./interfaces/imail.service";
import type { MailMessage, MailTransport } from "./mail.types";
import { htmlToText } from "./mail.templates";

class SmtpTransport implements MailTransport {
  readonly name = "smtp";
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  async deliver(m: MailMessage & { from: string }): Promise<void> {
    await this.transporter.sendMail({
      from: m.from,
      to: m.to,
      cc: m.cc,
      replyTo: m.replyTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments,
    });
  }
}

// No SMTP configured: write the email to the log. Locally this is how you click verify / reset links.
// In production only the envelope is logged, because bodies carry one-time links.
class LogTransport implements MailTransport {
  readonly name = "log";

  async deliver(m: MailMessage & { from: string }): Promise<void> {
    if (isProduction) {
      logger.warn({ to: m.to, subject: m.subject }, "SMTP_HOST is not set; email was not sent");
      return;
    }
    logger.info(
      { to: m.to, subject: m.subject, attachments: m.attachments?.map((a) => a.filename) },
      `Email (not sent, SMTP_HOST is empty):\n${m.text}`,
    );
  }
}

// The one place emails leave the app. Inject IMailService (TYPES.MailService) in any module.
@injectable()
export class MailService implements IMailService {
  private readonly transport: MailTransport = env.SMTP_HOST ? new SmtpTransport() : new LogTransport();

  async send(message: MailMessage): Promise<void> {
    const from = message.fromName ? withName(env.MAIL_FROM, message.fromName) : env.MAIL_FROM;
    await this.transport.deliver({ ...message, from, text: message.text ?? htmlToText(message.html) });
    logger.info(
      { to: message.to, subject: message.subject, transport: this.transport.name },
      this.transport.name === "smtp" ? "Email sent" : "Email logged, not sent",
    );
  }

  async sendQuietly(message: MailMessage): Promise<void> {
    try {
      await this.send(message);
    } catch (err) {
      logger.error({ err, to: message.to, subject: message.subject }, "Email failed");
    }
  }
}

// "Shop name <no-reply@x>" keeps the configured address (SPF/DKIM) but shows another sender name.
function withName(from: string, name: string): string {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  return `"${name.replace(/["<>]/g, "")}" <${address}>`;
}
