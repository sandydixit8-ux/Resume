import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { AppException } from "../../common/exceptions/app.exception";

export type RefreshTokenPayload = { sub: string; sid: string; typ: "refresh" };

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get accessSecret(): string {
    return this.config.getOrThrow<string>("JWT_ACCESS_SECRET");
  }

  get refreshSecret(): string {
    return this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
  }

  get accessTtlSeconds(): number {
    return Number(this.config.get("JWT_ACCESS_TTL_SECONDS") ?? 900);
  }

  get refreshTtlDays(): number {
    return Number(this.config.get("JWT_REFRESH_TTL_DAYS") ?? 30);
  }

  signAccessToken(userId: string, sessionId: string): string {
    return this.jwtService.sign(
      { sub: userId, sessionId } satisfies AccessTokenPayload,
      { secret: this.accessSecret, expiresIn: this.accessTtlSeconds },
    );
  }

  async createSessionAndTokens(userId: string): Promise<TokenPair & { sessionId: string }> {
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: this.hash(refreshToken),
        expiresAt,
      },
    });

    return {
      sessionId,
      refreshToken,
      accessToken: this.signAccessToken(userId, sessionId),
      expiresIn: this.accessTtlSeconds,
    };
  }

  async rotateSession(refreshToken: string): Promise<TokenPair & { userId: string }> {
    const tokenHash = this.hash(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
    });
    if (!session) {
      throw new AppException("Invalid refresh token", "AUTH_INVALID", 401);
    }
    if (session.expiresAt < new Date()) {
      throw new AppException("Session expired, please log in again", "AUTH_EXPIRED", 401);
    }

    const next = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hash(next), expiresAt },
    });

    return {
      userId: session.userId,
      accessToken: this.signAccessToken(session.userId, session.id),
      refreshToken: next,
      expiresIn: this.accessTtlSeconds,
    };
  }

  async revokeSession(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}