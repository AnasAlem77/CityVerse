import { Test, TestingModule } from '@nestjs/testing';
import { SavedPlacesController } from './saved-places.controller';

describe('SavedPlacesController', () => {
  let controller: SavedPlacesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedPlacesController],
    }).compile();

    controller = module.get<SavedPlacesController>(SavedPlacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
