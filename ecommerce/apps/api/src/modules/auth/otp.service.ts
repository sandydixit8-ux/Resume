import { Injectable } from "@nestjs/common";
import { OtpPurpose, OtpSendRequest } from "@nexus/contracts";
import * as crypto from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";
import { AppException, ValidationException } from "../../common/exceptions/app.exception";

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async send(request: OtpSendRequest): Promise<{ sentTo: string; expiresInSeconds: number }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await this.prisma.otpToken.create({
      data: {
        destination: request.destination.toLowerCase(),
        channel: request.channel,
        purpose: request.purpose,
        codeHash: this.hash(code),
        expiresAt,
      },
    });

    if (request.channel === "email") {
      await this.notifications.sendOtpEmail(request.destination, code, request.purpose);
    } else {
      await this.notifications.sendOtpSms(request.destination, code, request.purpose);
    }

    return { sentTo: request.destination, expiresInSeconds: CODE_TTL_MS / 1000 };
  }

  async verify(destination: string, purpose: OtpPurpose, code: string): Promise<void> {
    const token = await this.prisma.otpToken.findFirst({
      where: {
        destination: destination.toLowerCase(),
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!token) {
      throw new AppException("Invalid or expired code", "AUTH_OTP_INVALID", 400);
    }

    if (token.attempts >= MAX_ATTEMPTS) {
      throw new AppException("Too many attempts for this code", "AUTH_OTP_INVALID", 429);
    }

    if (token.codeHash !== this.hash(code)) {
      await this.prisma.otpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppException("Incorrect code", "AUTH_OTP_INVALID", 400);
    }

    await this.prisma.otpToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
  }

  private generateCode(): string {
    return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  }

  private hash(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }
}

export function assertOtpPurposeSupported(purpose: OtpPurpose): void {
  const supported = ["EMAIL_VERIFY", "PHONE_VERIFY", "PASSWORD_RESET", "LOGIN"];
  if (!supported.includes(purpose)) {
    throw ValidationException({ purpose }, "Unsupported OTP purpose");
  }
}