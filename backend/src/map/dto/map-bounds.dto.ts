import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class MapBoundsDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) north: number;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) south: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) east: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) west: number;
  @Type(() => Number) @IsNumber() @Min(1) @Max(500) limit = 300;
  @IsOptional() @IsString() category?: string;
}
