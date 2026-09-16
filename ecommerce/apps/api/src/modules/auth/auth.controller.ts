import { Body, Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { AppException } from "../../common/exceptions/app.exception";
import { AuthService } from "./auth.service";
import {
  ChangePasswordDto,
  LoginDto,
  OtpSendDto,
  OtpVerifyDto,
  PasswordResetDto,
  RegisterDto,
} from "./dto/auth.dto";

const REFRESH_COOKIE = "nexus_refresh";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Register a new account" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: "Log in" })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.refreshTokenFrom(req);
    const result = await this.authService.refresh(token!);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Log out and revoke refresh token" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.refreshTokenFrom(req, false);
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE);
  }

  @Public()
  @Post("otp/send")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Send an OTP to an email or phone" })
  sendOtp(@Body() dto: OtpSendDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Verify an OTP" })
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post("password-reset")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Reset password using OTP" })
  resetPassword(@Body() dto: PasswordResetDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Post("me/change-password")
  @HttpCode(204)
  @ApiOperation({ summary: "Change password for the current user" })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    await this.authService.changePassword(userId, dto);
  }

  private setRefreshCookie(res: Response, token: string) {
    const maxAge = Number(this.config.get("JWT_REFRESH_TTL_DAYS") ?? 30) * 24 * 60 * 60 * 1000;
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get("NODE_ENV") === "production",
      sameSite: "lax",
      maxAge,
      path: "/api/v1/auth",
    });
  }

  private refreshTokenFrom(req: Request, required = true): string | undefined {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (cookie) return cookie;
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    if (bodyToken) return bodyToken;
    if (required) {
      throw new AppException("Refresh token missing", "AUTH_INVALID", 401);
    }
    return undefined;
  }
}