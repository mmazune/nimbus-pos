import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, PinLoginDto, RefreshDto } from './dto';
import { JwtAuthGuard, PermissionGuard, PlatformAccessGuard } from '../../common/guards';
import { CurrentUser, Permissions } from '../../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
