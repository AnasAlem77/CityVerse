import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OsmController } from './osm/osm.controller';
import { PlacesController } from './places/places.controller';
import { PlaceImagesController } from './place-images/place-images.controller';
import { JwtGuard } from './auth/jwt.guard';
import { AdminGuard } from './auth/guards/admin.guard';

describe('security-sensitive controller guards', () => {
  it('requires JWT and admin authorization for OSM mutations', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OsmController.prototype.importNearbyPlaces)).toEqual([JwtGuard, AdminGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, OsmController.prototype.updateExistingPlaces)).toEqual([JwtGuard, AdminGuard]);
  });

  it('requires JWT and admin authorization for shared-data mutations', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PlacesController.prototype.createPlace)).toEqual([JwtGuard, AdminGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, PlaceImagesController.prototype.addImage)).toEqual([JwtGuard, AdminGuard]);
  });

  it('keeps public place browsing unprotected except for throttling', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PlacesController.prototype.getPlaces)).toHaveLength(1);
  });
});
