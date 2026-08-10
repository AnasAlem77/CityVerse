export class CreatePlaceDto {
  name: string;
  description?: string;
  category: string;

  latitude: number;
  longitude: number;

  cityId: string;
}
