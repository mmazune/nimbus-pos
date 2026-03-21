import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma';
import { AuditModule } from './common/audit';
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FloorModule } from './modules/floor/floor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    TenancyModule,
    SettingsModule,
    FloorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
