import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserType => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserType }>();
    return request.user as CurrentUserType;
  },
);