import { Injectable, Logger } from "@nestjs/common";
import { NotificationProvider, EmailMessage, SmsMessage } from "./notification-provider.interface";

@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger("NotificationProvider");

  async sendEmail(message: EmailMessage): Promise<void> {
    this.logger.log(`[EMAIL] to=${message.to} subject=${message.subject}`);
    this.logger.log(message.text);
  }

  async sendSms(message: SmsMessage): Promise<void> {
    this.logger.log(`[SMS] to=${message.to}`);
    this.logger.log(message.text);
  }
}