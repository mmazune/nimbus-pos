import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsFacadeService } from './exports.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';
import { ReportsModule } from '../reports/reports.module';
import { DocumentsModule } from '../documents/documents.module';

/**
 * BG6 — Unified export/download facade module.
 *
 * Re-exports a normalisation layer over `ReportsService` and
 * `DocumentsService`. No new schema, no new generators — pure facade.
 */
@Module({
  imports: [Bg3ReliabilityModule, ReportsModule, DocumentsModule],
  controllers: [ExportsController],
  providers: [ExportsFacadeService],
  exports: [ExportsFacadeService],
})
export class ExportsModule {}
