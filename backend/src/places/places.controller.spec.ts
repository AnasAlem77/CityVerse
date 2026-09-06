import { Test, TestingModule } from '@nestjs/testing';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { CurationService } from './curation.service';

describe('PlacesController', () => {
  let controller: PlacesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [
        { provide: PlacesService, useValue: {} },
        { provide: CurationService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PlacesController>(PlacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
