import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { OtpPurpose, OtpSendRequest, OtpVerifyRequest, RegisterRequest } from "@nexus/contracts";

export class RegisterDto implements RegisterRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: "phone must be a valid E.164 number" })
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class OtpSendDto implements OtpSendRequest {
  @IsString()
  @MaxLength(255)
  destination!: string;

  @IsIn(["email", "sms"])
  channel!: "email" | "sms";

  @IsEnum({ EMAIL_VERIFY: "EMAIL_VERIFY", PHONE_VERIFY: "PHONE_VERIFY", PASSWORD_RESET: "PASSWORD_RESET", LOGIN: "LOGIN" })
  purpose!: OtpPurpose;
}

export class OtpVerifyDto implements OtpVerifyRequest {
  @IsString()
  @MaxLength(255)
  destination!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "code must be a 6-digit number" })
  code!: string;

  @IsEnum({ EMAIL_VERIFY: "EMAIL_VERIFY", PHONE_VERIFY: "PHONE_VERIFY", PASSWORD_RESET: "PASSWORD_RESET", LOGIN: "LOGIN" })
  purpose!: OtpPurpose;
}

export class PasswordResetDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}