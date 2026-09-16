export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SmsMessage = {
  to: string;
  text: string;
};

export interface NotificationProvider {
  sendEmail(message: EmailMessage): Promise<void>;
  sendSms(message: SmsMessage): Promise<void>;
}