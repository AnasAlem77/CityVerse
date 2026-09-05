export class CreatePlaceDto {
  name: string;
  description: string;
  category: string;
  subtype?: string;

  latitude: number;
  longitude: number;

  cityId: string;
}
