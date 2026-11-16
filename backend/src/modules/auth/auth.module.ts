import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  ActiveSipaGuard,
  JwtAuthGuard,
  RolesGuard,
} from '../../common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret:
        process.env.JWT_ACCESS_SECRET ||
        'raddina_jwt_access_secret_key_2026_pbkk_its',
      signOptions: {
        expiresIn: 900,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, ActiveSipaGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard, ActiveSipaGuard],
})
export class AuthModule {}
