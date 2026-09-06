import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = this.readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000);
  private readonly limit = this.readPositiveInt('RATE_LIMIT_MAX', 60);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ ip?: string; path?: string }>();
    const key = `${request.ip ?? 'unknown'}:${request.path ?? 'unknown'}`;
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count > this.limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private readPositiveInt(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
