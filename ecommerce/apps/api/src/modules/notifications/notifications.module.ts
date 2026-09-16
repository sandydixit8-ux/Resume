import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConsoleNotificationProvider } from "./console-notification.provider";
import { NotificationProvider } from "./notification-provider.interface";
import { NotificationService } from "./notification.service";
import { NOTIFICATION_PROVIDER } from "./notification.service";

@Module({
  providers: [
    NotificationService,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): NotificationProvider => {
        const provider = config.get<string>("EMAIL_PROVIDER") ?? "console";
        if (provider === "console") {
          return new ConsoleNotificationProvider();
        }
        throw new Error(`Unsupported notification provider: ${provider}`);
      },
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}