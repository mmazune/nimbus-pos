import { Controller, Post, Get, Patch, Body, UseGuards, Req, Param, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { QuickPinService } from './quick-pin.service';
import { InvitationLifecycleService } from './invitation-lifecycle.service';
import { PasswordLifecycleService } from './password-lifecycle.service';
import {
  LoginDto,
  PinLoginDto,
  RefreshDto,
  QuickPinLoginDto,
  IssueQuickPinDto,
  ResetQuickPinDto,
  UpdateQuickPinSettingsDto,
  AcceptInvitationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ForcePasswordChangeDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, PlatformAccessGuard } from '../../common/guards';
import { CurrentUser, Permissions } from '../../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly quickPinService: QuickPinService,
    private readonly invitationLifecycle: InvitationLifecycleService,
    private readonly passwordLifecycle: PasswordLifecycleService,
  ) { }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('pin-login')
  async pinLogin(@Body() dto: PinLoginDto, @Req() req: Request) {
    return this.authService.pinLogin(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: { id: string; sessionId: string }, @Req() req: Request) {
    return this.authService.logout(user.id, user.sessionId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return this.authService.logoutAll(user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string; sessionId: string }) {
    return this.authService.me(user.id, user.sessionId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async sessions(@CurrentUser() user: { id: string }) {
    return this.authService.sessions(user.id);
  }

  /**
   * Permission test endpoint.
   * Proves that the PermissionGuard + PlatformAccessGuard work.
   * Requires identity:access-matrix:read permission.
   */
  @Get('_perm-test')
  @UseGuards(JwtAuthGuard, PermissionGuard, PlatformAccessGuard)
  @Permissions('identity:access-matrix:read')
  async permTest(@CurrentUser() user: { id: string; email: string; permissions: string[] }) {
    return {
      message: 'Permission check passed',
      userId: user.id,
      email: user.email,
      grantedPermissions: user.permissions,
    };
  }

  // ── M3.1 Quick PIN Endpoints ──

  @Post('quick-pin-login')
  async quickPinLogin(@Body() dto: QuickPinLoginDto, @Req() req: Request) {
    return this.quickPinService.quickPinLogin(dto.branchId, dto.pin, dto.platform, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('users/:id/issue-quick-pin')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('identity:user:write')
  async issueQuickPin(
    @Param('id') userId: string,
    @Body() dto: IssueQuickPinDto,
    @CurrentUser() actor: { id: string },
    @Req() req: Request,
  ) {
    return this.quickPinService.issueQuickPin(userId, actor.id, dto.branchId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('users/:id/reset-quick-pin')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('identity:user:write')
  async resetQuickPin(
    @Param('id') userId: string,
    @Body() dto: ResetQuickPinDto,
    @CurrentUser() actor: { id: string },
    @Req() req: Request,
  ) {
    return this.quickPinService.resetQuickPin(userId, actor.id, dto.branchId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('users/:id/quick-pin-settings')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('identity:user:write')
  async updateQuickPinSettings(
    @Param('id') userId: string,
    @Body() dto: UpdateQuickPinSettingsDto,
    @CurrentUser() actor: { id: string },
    @Req() req: Request,
  ) {
    return this.quickPinService.updateQuickPinSettings(userId, actor.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('users/:id/quick-pin-status')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('identity:user:read')
  async quickPinStatus(@Param('id') userId: string) {
    return this.quickPinService.getQuickPinStatus(userId);
  }

  // ── BG1: Invitation Acceptance ──

  @Post('invitations/accept')
  @HttpCode(200)
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    return this.invitationLifecycle.accept(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── BG1: Password Lifecycle ──

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.passwordLifecycle.forgotPassword(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.passwordLifecycle.resetPassword(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('force-password-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async forcePasswordChange(
    @CurrentUser() user: { id: string },
    @Body() dto: ForcePasswordChangeDto,
    @Req() req: Request,
  ) {
    return this.passwordLifecycle.forcePasswordChange(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
