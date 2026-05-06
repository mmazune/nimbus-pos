import { Module } from '@nestjs/common';
import { ControlPlaneController } from './controlplane.controller';
import { ControlPlaneService } from './controlplane.service';
import { FeatureFlagService } from './feature-flag.service';
import { MaintenanceWindowService } from './maintenance-window.service';
import { TrainingSessionService } from './training-session.service';
import { FlagAuditService } from './flag-audit.service';

@Module({
    controllers: [ControlPlaneController],
    providers: [
        ControlPlaneService,
        FeatureFlagService,
        MaintenanceWindowService,
        TrainingSessionService,
        FlagAuditService,
    ],
    exports: [
        ControlPlaneService,
        FeatureFlagService,
        MaintenanceWindowService,
        TrainingSessionService,
        FlagAuditService,
    ],
})
export class ControlPlaneModule { }
