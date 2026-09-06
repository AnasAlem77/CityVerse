import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const context = (ip = '127.0.0.1') => ({
    switchToHttp: () => ({ getRequest: () => ({ ip, path: '/test' }) }),
  }) as any;

  it('rejects requests after the configured limit', () => {
    const previousLimit = process.env.RATE_LIMIT_MAX;
    process.env.RATE_LIMIT_MAX = '1';
    const guard = new RateLimitGuard();

    expect(guard.canActivate(context())).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(
      new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS),
    );

    if (previousLimit === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = previousLimit;
  });
});
