import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificationProvider } from "./notification-provider.interface";

export const NOTIFICATION_PROVIDER = "NOTIFICATION_PROVIDER";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger("NotificationService");

  constructor(@Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider) {}

  async sendOtpEmail(destination: string, code: string, purpose: string): Promise<void> {
    await this.provider.sendEmail({
      to: destination,
      subject: `Your verification code is ${code}`,
      text: `Your Nexus verification code is ${code}. Valid for 5 minutes. Purpose: ${purpose}.`,
    });
  }

  async sendOtpSms(destination: string, code: string, purpose: string): Promise<void> {
    await this.provider.sendSms({
      to: destination,
      text: `Your Nexus verification code is ${code}. Valid for 5 minutes. Purpose: ${purpose}.`,
    });
  }
}