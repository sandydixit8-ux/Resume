import { Injectable } from "@nestjs/common";
import { User, UserStatus } from "@prisma/client";
import { CurrentUser, LoginResponse, RegisterResponse } from "@nexus/contracts";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { AppException, ConflictException } from "../../common/exceptions/app.exception";
import { OtpService } from "./otp.service";
import { TokenService } from "./token.service";
import { ChangePasswordDto, LoginDto, OtpSendDto, OtpVerifyDto, PasswordResetDto, RegisterDto } from "./dto/auth.dto";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw ConflictException("An account with this email already exists");
    }
    if (dto.phone) {
      const phoneUser = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneUser) {
        throw ConflictException("An account with this phone number already exists");
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });

    const role = await this.prisma.role.findUnique({ where: { code: "CUSTOMER" } });
    if (role) {
      await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }

    await this.otpService.send({ destination: email, channel: "email", purpose: "EMAIL_VERIFY" });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: false,
      phoneVerified: false,
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse & { refreshToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppException("Invalid email or password", "AUTH_INVALID", 401);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppException(`Account temporarily locked. Try again in ${minutes} minutes.`, "AUTH_LOCKED", 423);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin(user);
      throw new AppException("Invalid email or password", "AUTH_INVALID", 401);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const pair = await this.tokenService.createSessionAndTokens(user.id);
    return { ...pair, user: await this.currentUserFor(user) };
  }

  async refresh(refreshToken: string): Promise<LoginResponse & { refreshToken: string }> {
    const pair = await this.tokenService.rotateSession(refreshToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: pair.userId } });
    const { refreshToken: _, ...rest } = pair;
    return { ...rest, refreshToken: pair.refreshToken, user: await this.currentUserFor(user) };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeSession(refreshToken);
    }
  }

  async sendOtp(dto: OtpSendDto) {
    return this.otpService.send(dto);
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<void> {
    await this.otpService.verify(dto.destination, dto.purpose, dto.code);

    if (dto.purpose === "EMAIL_VERIFY") {
      await this.prisma.user.updateMany({
        where: { email: dto.destination.toLowerCase() },
        data: { emailVerifiedAt: new Date() },
      });
    }
    if (dto.purpose === "PHONE_VERIFY") {
      await this.prisma.user.updateMany({
        where: { phone: dto.destination },
        data: { phoneVerifiedAt: new Date() },
      });
    }
    if (dto.purpose === "EMAIL_VERIFY" || dto.purpose === "PHONE_VERIFY") {
      await this.prisma.user.updateMany({
        where: {
          OR: [{ email: dto.destination.toLowerCase() }, { phone: dto.destination }],
          status: UserStatus.PENDING_VERIFICATION,
        },
        data: { status: UserStatus.ACTIVE },
      });
    }
  }

  async resetPassword(dto: PasswordResetDto): Promise<void> {
    await this.otpService.verify(dto.email, "PASSWORD_RESET", dto.code);

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppException("Account not found", "NOT_FOUND", 404);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppException("Current password is incorrect", "AUTH_INVALID", 400);
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async currentUserFor(user: User): Promise<CurrentUser> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    const permissions = new Set<string>();
    for (const r of roles) {
      for (const rp of r.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      name: user.name,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      roles: roles.map((r) => r.role.code),
      permissions: [...permissions],
    };
  }

  private async recordFailedLogin(user: User): Promise<void> {
    const next = user.failedLoginCount + 1;
    const data: { failedLoginCount: number; lockedUntil?: Date } = { failedLoginCount: next };
    if (next >= MAX_FAILED_LOGINS) {
      data.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    }
    await this.prisma.user.update({ where: { id: user.id }, data });
  }
}