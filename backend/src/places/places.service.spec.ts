import { Test, TestingModule } from '@nestjs/testing';
import { PlacesService } from './places.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlacesService', () => {
  let service: PlacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlacesService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
