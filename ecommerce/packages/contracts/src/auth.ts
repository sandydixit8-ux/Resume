export type RegisterRequest = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

export type RegisterResponse = {
  id: string;
  email: string;
  name: string;
  phoneVerified: boolean;
  emailVerified: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
};

export type RefreshRequest = {
  refreshToken?: string;
};

export type OtpPurpose = "EMAIL_VERIFY" | "PHONE_VERIFY" | "PASSWORD_RESET" | "LOGIN";

export type OtpSendRequest = {
  destination: string;
  channel: "email" | "sms";
  purpose: OtpPurpose;
};

export type OtpVerifyRequest = {
  destination: string;
  code: string;
  purpose: OtpPurpose;
};

export type CurrentUser = {
  id: string;
  email: string;
  phone?: string;
  name: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  roles: string[];
  permissions: string[];
};

export type RoleAssignment = {
  roleCode: string;
  scope?: string;
}