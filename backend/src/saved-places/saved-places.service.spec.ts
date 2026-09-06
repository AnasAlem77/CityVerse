import { Test, TestingModule } from '@nestjs/testing';
import { SavedPlacesService } from './saved-places.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SavedPlacesService', () => {
  let service: SavedPlacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SavedPlacesService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<SavedPlacesService>(SavedPlacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
