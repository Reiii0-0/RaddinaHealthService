import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@shared/api-contracts';

export interface JwtUserPayload {
  sub: string;
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  noSipa: string | null;
  sipaExpiryDate: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
