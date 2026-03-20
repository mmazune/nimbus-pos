import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma';
import { AuditModule } from './common/audit';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuditModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
