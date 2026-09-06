import { Test, TestingModule } from '@nestjs/testing';
import { SavedPlacesController } from './saved-places.controller';
import { SavedPlacesService } from './saved-places.service';

describe('SavedPlacesController', () => {
  let controller: SavedPlacesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedPlacesController],
      providers: [{ provide: SavedPlacesService, useValue: {} }],
    }).compile();

    controller = module.get<SavedPlacesController>(SavedPlacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
