import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { ExportsFacadeService } from './exports.service';
import { CreateExportDto, ListExportsDto } from './dto';
import {
  JwtAuthGuard,
  PermissionGuard,
  BranchContextGuard,
} from '../../common/guards';
import {
  CurrentUser,
  Permissions,
  RequireBranchContext,
} from '../../common/decorators';
import { Bg3ReliabilityService } from '../bg3-reliability';

/**
 * BG6 — Unified export/download facade controller.
 *
 * Surface:
 *   POST   /api/exports               — request a new export (delegates)
 *   GET    /api/exports               — list/history (unifies reports + documents)
 *   GET    /api/exports/:id           — normalized export detail
 *   GET    /api/exports/:id/download  — stream the underlying file
 *
 * Locked rules:
 *   - `/api/auth/me` remains the canonical context source.
 *   - The facade is normalisation only — no shadow generation logic.
 *   - POST goes through `Bg3ReliabilityService.guard` with
 *     `category: null` (the export *request* itself is a metadata
 *     artefact; downstream report/document generators carry their own
 *     domain-level guards). M42 maintenance windows therefore do not
 *     block facade-level export requests by default.
 *   - Downloads are pure reads → no idempotency.
 *   - Public diner payments / hotel structures are untouched.
 */
@Controller('exports')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class ExportsController {
  constructor(
    private readonly exports: ExportsFacadeService,
    private readonly bg3: Bg3ReliabilityService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Permissions('exports:write')
  async create(
    @Body() dto: CreateExportDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bg3.guard(
      {
        req,
        scope: 'exports.create',
        routeMethod: 'POST',
        routePath: '/api/exports',
        category: null,
        idempotencyMode: 'optional',
        fingerprintSource: { dto },
        actorUserId: user.id,
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
      },
      () =>
        this.exports.createExport({
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          userId: user.id,
          dto,
        }),
    );
  }

  @Get()
  @Permissions('exports:read')
  async list(@Query() query: ListExportsDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.exports.listExports({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      query,
    });
  }

  @Get(':id/download')
  @Permissions('exports:download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ctx = (req as any).branchContext;
    const file = await this.exports.resolveDownload({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      userId: user.id,
      id,
      auditMeta: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      },
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    const stream = fs.createReadStream(file.filePath);
    stream.pipe(res);
  }

  @Get(':id')
  @Permissions('exports:read')
  async detail(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.exports.getExport({ orgId: ctx.organizationId, id });
  }
}
