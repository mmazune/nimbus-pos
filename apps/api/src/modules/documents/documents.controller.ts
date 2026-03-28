import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import {
  UploadDocumentDto,
  ListDocumentsQueryDto,
  LinkDocumentDto,
  UpdateStorageConfigDto,
  UpdateDocumentMetadataDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { StorageProviderType } from '@prisma/client';
import * as fs from 'fs';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── Upload ──

  @Post('upload')
  @Permissions('pos:documents:upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.documentsService.uploadDocument(user.id, ctx, dto, file, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── List ──

  @Get()
  @Permissions('pos:documents:read')
  async list(@Query() query: ListDocumentsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.documentsService.listDocuments(ctx, query);
  }

  // ── Storage Config (before :id routes) ──

  @Get('storage-config')
  @Permissions('pos:documents:storage-config:read')
  async getStorageConfig(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.documentsService.getStorageConfig(ctx);
  }

  @Patch('storage-config/:providerType')
  @Permissions('pos:documents:storage-config:update')
  async updateStorageConfig(
    @Param('providerType') providerType: StorageProviderType,
    @Body() dto: UpdateStorageConfigDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.documentsService.updateStorageConfig(user.id, ctx, providerType, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Get by ID ──

  @Get(':id')
  @Permissions('pos:documents:read')
  async get(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.documentsService.getDocument(id, ctx);
  }

  // ── Download ──

  @Get(':id/download')
  @Permissions('pos:documents:download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ctx = (req as any).branchContext;
    const { filePath, fileName, mimeType } = await this.documentsService.downloadDocument(
      id,
      user.id,
      ctx,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  // ── Delete (soft) ──

  @Delete(':id')
  @Permissions('pos:documents:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.documentsService.deleteDocument(id, user.id, ctx, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Link ──

  @Post(':id/link')
  @Permissions('pos:documents:link')
  async link(
    @Param('id') id: string,
    @Body() dto: LinkDocumentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.documentsService.linkDocument(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Get Links ──

  @Get(':id/links')
  @Permissions('pos:documents:read')
  async getLinks(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.documentsService.getDocumentLinks(id, ctx);
  }

  // ── Update Metadata ──

  @Patch(':id/metadata')
  @Permissions('pos:documents:metadata:update')
  async updateMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentMetadataDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.documentsService.updateDocumentMetadata(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
