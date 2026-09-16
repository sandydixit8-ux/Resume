import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ApiSuccessBody } from "@nexus/contracts";

export type PaginatedResponse<T> = { data: T[]; meta: Record<string, unknown> };

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload === undefined || payload === null) {
          const body: ApiSuccessBody<null> = { success: true, data: null };
          return body;
        }
        if (isPaginated(payload)) {
          const { data, meta, ...extra } = payload as Record<string, unknown> & { data: T[]; meta: Record<string, unknown> };
          return { success: true, data, meta, ...extra };
        }
        const body: ApiSuccessBody<T> = { success: true, data: payload };
        return body;
      }),
    );
  }
}

function isPaginated(value: unknown): value is PaginatedResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "meta" in value &&
    (value as { meta: unknown }).meta !== null &&
    typeof (value as { meta: unknown }).meta === "object"
  );
}