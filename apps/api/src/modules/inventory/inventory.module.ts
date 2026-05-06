import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ControlPlaneModule } from '../controlplane/controlplane.module';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [ControlPlaneModule, Bg3ReliabilityModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule { }
