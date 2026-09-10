export class CreatePlaceDto {
  name: string;
  description?: string | null;
  category: string;
  subtype?: string;

  latitude: number;
  longitude: number;

  cityId: string;
}
