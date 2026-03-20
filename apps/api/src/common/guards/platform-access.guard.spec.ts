import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAccessGuard } from './platform-access.guard';

const createMockContext = (
  user: Record<string, unknown>,
  headers: Record<string, string> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user, headers }),
    }),
  }) as unknown as ExecutionContext;

describe('PlatformAccessGuard', () => {
  let guard: PlatformAccessGuard;

  beforeEach(() => {
    guard = new PlatformAccessGuard();
  });

  it('should allow L5 user on WEB_BACKOFFICE', () => {
    const ctx = createMockContext(
      { id: 'user-1', roleLevel: 'L5' },
      { 'x-platform': 'WEB_BACKOFFICE' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow L5 user on KDS_SCREEN', () => {
    const ctx = createMockContext(
      { id: 'user-1', roleLevel: 'L5' },
      { 'x-platform': 'KDS_SCREEN' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny L1 user on WEB_BACKOFFICE', () => {
    const ctx = createMockContext(
      { id: 'user-1', roleLevel: 'L1' },
      { 'x-platform': 'WEB_BACKOFFICE' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow L1 user on MOBILE_APP', () => {
    const ctx = createMockContext(
      { id: 'user-1', roleLevel: 'L1' },
      { 'x-platform': 'MOBILE_APP' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny L2 user on WEB_BACKOFFICE', () => {
    const ctx = createMockContext(
      { id: 'user-1', roleLevel: 'L2' },
      { 'x-platform': 'WEB_BACKOFFICE' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should default to WEB_BACKOFFICE when header absent', () => {
    const ctx = createMockContext({ id: 'user-1', roleLevel: 'L5' }, {});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny L3 user on MOBILE_APP', () => {
    const ctx = createMockContext(
      { id: 'user-1', roleLevel: 'L3' },
      { 'x-platform': 'MOBILE_APP' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
