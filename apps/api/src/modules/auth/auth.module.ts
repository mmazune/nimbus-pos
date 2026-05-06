import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { QuickPinService } from './quick-pin.service';
import { InvitationLifecycleService } from './invitation-lifecycle.service';
import { PasswordLifecycleService } from './password-lifecycle.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'nimbus-dev-access-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m'),
        } as any,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    QuickPinService,
    InvitationLifecycleService,
    PasswordLifecycleService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    QuickPinService,
    InvitationLifecycleService,
    PasswordLifecycleService,
  ],
})
export class AuthModule { }
