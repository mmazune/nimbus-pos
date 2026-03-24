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
import { MenuModule } from './modules/menu/menu.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KdsModule } from './modules/kds/kds.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    TenancyModule,
    SettingsModule,
    FloorModule,
    MenuModule,
    RecipesModule,
    InventoryModule,
    OrdersModule,
    KdsModule,
    DiscountsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
