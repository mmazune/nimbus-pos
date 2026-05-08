import { Module } from '@nestjs/common';
import { HmsIntegrationController } from './hms-integration.controller';
import { HmsIntegrationService } from './hms-integration.service';
import { HmsAccessLogInterceptor } from './hms-access-log.interceptor';

/**
 * BG7 — HMS Integration module.
 *
 * Read-only `/api/hms/*` façade authenticated by inbound API key
 * (`x-api-key` header). PrismaModule and AuditModule are global so they do
 * not need to be re-imported. The interceptor is registered locally — it is
 * not wired as a global interceptor because it depends on `req.apiKeyContext`
 * populated by `ApiKeyAuthGuard`, which is only attached on this controller.
 */
@Module({
    controllers: [HmsIntegrationController],
    providers: [HmsIntegrationService, HmsAccessLogInterceptor],
    exports: [HmsIntegrationService],
})
export class HmsIntegrationModule { }
