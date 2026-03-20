import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

const createMockContext = (user: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as unknown as ExecutionContext;

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
  });

  it('should allow when user has required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['identity:access-matrix:read']);

    const ctx = createMockContext({
      id: 'user-1',
      permissions: ['identity:access-matrix:read', 'identity:user:read'],
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny when user lacks required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['identity:access-matrix:write']);

    const ctx = createMockContext({
      id: 'user-1',
      permissions: ['identity:user:read'],
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const ctx = createMockContext({ id: 'user-1', permissions: [] });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
