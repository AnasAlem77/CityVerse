import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a conflict for an existing email', async () => {
    const prisma = service['prisma'] as any;
    prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) };

    await expect(service.register({ email: 'existing@example.com', name: 'Existing', password: 'secret123' }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('creates a token that verifies with the configured JWT secret', async () => {
    const secret = 'test-shared-secret';
    const jwt = new JwtService({ secret });
    const prisma = service['prisma'] as any;
    service = new AuthService(prisma, jwt);
    prisma.user = {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER', password: await bcrypt.hash('secret123', 4) }),
    };

    const result = await service.login('user@example.com', 'secret123');
    expect(jwt.verify(result.access_token, { secret })).toMatchObject({ sub: 'user-1', role: 'USER' });
    expect(() => jwt.verify(result.access_token, { secret: 'different-secret' })).toThrow();
  });
});
