import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Response } from "express";
import { ApiFailureBody, ErrorCode } from "@nexus/contracts";
import { AppException } from "../exceptions/app.exception";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ requestId?: string; method?: string; url?: string }>();

    const requestId = request.requestId ?? undefined;

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = "INTERNAL_ERROR";
    let message = "Something went wrong. Please try again later.";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === "string") {
        message = resp;
      } else if (resp && typeof resp === "object") {
        const body = resp as Record<string, unknown>;
        message = (body.message as string) ?? exception.message;
        if (Array.isArray(body.message)) {
          code = "VALIDATION_ERROR";
          const first = body.message[0] as string;
          message = first;
          details = { fields: body.message };
        }
      }
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode} ${(exception as Error)?.message ?? "unknown error"}`,
        (exception as Error)?.stack,
      );
    }

    const errorBody: ApiFailureBody = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };

    response.status(statusCode).json(errorBody);
  }
}