import { IsInt, IsString, Max, Min } from 'class-validator';

export class RatePlaceDto {
  @IsString()
  placeId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
