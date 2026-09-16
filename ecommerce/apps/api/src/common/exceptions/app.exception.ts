import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "@nexus/contracts";

export class AppException extends HttpException {
  constructor(
    message: string,
    readonly code: ErrorCode,
    statusCode: number = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super({ message, code, statusCode, details }, statusCode);
  }
}

export const NotFoundException = (resource: string) =>
  new AppException(`${resource} not found`, "NOT_FOUND", HttpStatus.NOT_FOUND);

export const ConflictException = (message: string) =>
  new AppException(message, "CONFLICT", HttpStatus.CONFLICT);

export const ForbiddenException = (message = "You do not have permission to perform this action") =>
  new AppException(message, "FORBIDDEN", HttpStatus.FORBIDDEN);

export const UnauthorizedException = (message = "Authentication required") =>
  new AppException(message, "AUTH_INVALID", HttpStatus.UNAUTHORIZED);

export const ValidationException = (details: Record<string, unknown>, message = "Validation failed") =>
  new AppException(message, "VALIDATION_ERROR", HttpStatus.BAD_REQUEST, details);

export const UnprocessableException = (message: string) =>
  new AppException(message, "UNPROCESSABLE", HttpStatus.UNPROCESSABLE_ENTITY);