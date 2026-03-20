import { Controller, Get, Patch, Put, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import {
  UpdateOrgSettingsDto,
  UpdateCurrencyDto,
  UpdateTaxMatrixDto,
  UpdateRoundingDto,
  UpdateThresholdsDto,
  UpdatePlatformAccessDto,
  CreateExchangeRateDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { CurrentUser, Permissions } from '../../common/decorators';

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── GET /settings ──

  @Get('settings')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async getSettings(@CurrentUser() user: { id: string }) {
    return this.settingsService.getSettings(user.id);
  }

  // ── PATCH /settings ──

  @Patch('settings')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async updateSettings(
    @Body() dto: UpdateOrgSettingsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.updateSettings(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── GET /settings/currency ──

  @Get('settings/currency')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async getCurrency(@CurrentUser() user: { id: string }) {
    return this.settingsService.getCurrency(user.id);
  }

  // ── PUT /settings/currency ──

  @Put('settings/currency')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async updateCurrency(
    @Body() dto: UpdateCurrencyDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.updateCurrency(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── GET /settings/tax-matrix ──

  @Get('settings/tax-matrix')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async getTaxMatrix(@CurrentUser() user: { id: string }) {
    return this.settingsService.getTaxMatrix(user.id);
  }

  // ── PUT /settings/tax-matrix ──

  @Put('settings/tax-matrix')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async updateTaxMatrix(
    @Body() dto: UpdateTaxMatrixDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.updateTaxMatrix(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── GET /settings/rounding ──

  @Get('settings/rounding')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async getRounding(@CurrentUser() user: { id: string }) {
    return this.settingsService.getRounding(user.id);
  }

  // ── PUT /settings/rounding ──

  @Put('settings/rounding')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async updateRounding(
    @Body() dto: UpdateRoundingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.updateRounding(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── GET /thresholds ──

  @Get('thresholds')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async getThresholds(@CurrentUser() user: { id: string }) {
    return this.settingsService.getThresholds(user.id);
  }

  // ── PATCH /thresholds ──

  @Patch('thresholds')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async updateThresholds(
    @Body() dto: UpdateThresholdsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.updateThresholds(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── GET /settings/platform-access ──

  @Get('settings/platform-access')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async getPlatformAccess(@CurrentUser() user: { id: string }) {
    return this.settingsService.getPlatformAccess(user.id);
  }

  // ── PUT /settings/platform-access ──

  @Put('settings/platform-access')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async updatePlatformAccess(
    @Body() dto: UpdatePlatformAccessDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.updatePlatformAccess(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── POST /settings/exchange-rate ──

  @Post('settings/exchange-rate')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:settings:manage')
  async createExchangeRate(
    @Body() dto: CreateExchangeRateDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.settingsService.createExchangeRate(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── GET /settings/exchange-rates ──

  @Get('settings/exchange-rates')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('tenancy:org:read')
  async listExchangeRates(@CurrentUser() user: { id: string }) {
    return this.settingsService.listExchangeRates(user.id);
  }
}
