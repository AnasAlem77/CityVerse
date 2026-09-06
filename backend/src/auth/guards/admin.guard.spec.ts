import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const context = (user: unknown) => ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

  it('allows admins and rejects unauthenticated or regular users', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(context({ role: 'ADMIN' }))).toBe(true);
    expect(guard.canActivate(context({ role: 'USER' }))).toBe(false);
    expect(guard.canActivate(context(undefined))).toBe(false);
  });
});
