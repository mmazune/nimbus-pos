import { Module } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { ControlPlaneModule } from '../controlplane/controlplane.module';
import { Bg3ReliabilityService } from './bg3-reliability.service';

/**
 * BG3 — Reliability Rollout facade module.
 *
 * Bundles the M41 IdempotencyService with the M42 MaintenanceWindowService
 * + TrainingSessionService into a single `Bg3ReliabilityService` so risky
 * write controllers can wrap themselves with one call.
 */
@Module({
    imports: [ReliabilityModule, ControlPlaneModule],
    providers: [Bg3ReliabilityService],
    exports: [Bg3ReliabilityService],
})
export class Bg3ReliabilityModule { }
