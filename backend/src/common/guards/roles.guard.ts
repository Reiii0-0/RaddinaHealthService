import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared/api-contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(@Optional() reflector?: Reflector) {
    this.reflector = reflector ?? new Reflector();
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Pemeriksaan hak akses gagal dilakukan. Identitas peran pengguna tidak ditemukan pada konteks sesi saat ini. Silakan masuk terlebih dahulu sebelum mengakses fitur ini.',
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Akses ke operasi ini ditolak. Akun Anda saat ini memegang peran ${user.role}, sedangkan fitur ini mewajibkan salah satu peran berikut: ${requiredRoles.join(', ')}. Silakan hubungi Pemilik Apotek (OWNER) apabila tugas Anda memerlukan perubahan peran.`,
      );
    }

    return true;
  }
}
