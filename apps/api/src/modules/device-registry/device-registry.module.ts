import { Module } from '@nestjs/common';
import { DeviceRegistryController } from './device-registry.controller';
import { DeviceRegistryService } from './device-registry.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

/**
 * BG5 — Device / Printer / Terminal Registry module.
 *
 * Pure registry/configuration layer over two new tables (Device, PrinterRoute).
 * No physical hardware integration; pairing and routing are metadata only.
 * Mutating endpoints reuse the BG3 reliability facade for idempotency.
 */
@Module({
    imports: [Bg3ReliabilityModule],
    controllers: [DeviceRegistryController],
    providers: [DeviceRegistryService],
    exports: [DeviceRegistryService],
})
export class DeviceRegistryModule { }
