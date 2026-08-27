export class CreateCityDto {
  name: string;

  country: string;

  description?: string;

  image?: string;

  featured?: boolean;

  featuredOrder?: number;

  latitude: number;

  longitude: number;
}
