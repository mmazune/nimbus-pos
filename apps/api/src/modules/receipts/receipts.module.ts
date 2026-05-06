import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

/**
 * BG4.A — Receipts surface module.
 *
 * Pure read/notify layer over Order + Payment. No new schema, no new
 * domain mutations. Reuses the BG3 reliability facade for idempotent
 * reprint / send operations.
 */
@Module({
    imports: [Bg3ReliabilityModule],
    controllers: [ReceiptsController],
    providers: [ReceiptsService],
    exports: [ReceiptsService],
})
export class ReceiptsModule { }
