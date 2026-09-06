import { IsIn, IsLatitude, IsLongitude, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { TravelMode } from '../routing.types';

class CoordinateDto { @IsNumber() @IsLatitude() latitude: number; @IsNumber() @IsLongitude() longitude: number; }
export class RouteRequestDto {
  @ValidateNested() @Type(() => CoordinateDto) origin: CoordinateDto;
  @ValidateNested() @Type(() => CoordinateDto) destination: CoordinateDto;
  @IsIn(['driving', 'cycling', 'walking']) mode: TravelMode;
}
