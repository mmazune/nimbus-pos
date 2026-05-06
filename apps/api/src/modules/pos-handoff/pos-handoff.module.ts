import { Module } from '@nestjs/common';
import { PosHandoffController } from './pos-handoff.controller';
import { PosHandoffService } from './pos-handoff.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

/**
 * BG4.B — POS Order Handoff module.
 *
 * Adds split-bill / split-items / merge / transfer-table /
 * transfer-server / move-items endpoints under /api/pos/orders/*.
 * Reuses the BG3 reliability facade for idempotency. PrismaService and
 * AuditService are provided globally by the root AppModule.
 */
@Module({
    imports: [Bg3ReliabilityModule],
    controllers: [PosHandoffController],
    providers: [PosHandoffService],
    exports: [PosHandoffService],
})
export class PosHandoffModule { }
