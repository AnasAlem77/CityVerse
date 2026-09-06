const API_URL = "http://localhost:3001";

export type User = {
  id: string;
  email: string;
  name: string;
};

export type CitySummary = {
  id: string;
  name: string;
  country: string;
  description?: string | null;
  image?: string | null;
  featured?: boolean;
  featuredOrder?: number | null;
  timezone?: string;
  _count?: {
    places: number;
  };
};

export type FeaturedCity = CitySummary & {
  description: string;
  image: string;
  featuredOrder: number;
};

export type CitiesResponse = {
  data: CitySummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type LoginResponse = {
  access_token: string;
  user: User;
};

export type RegisterResponse = User;

export type Review = {
  id: string;
  rating: number;
  comment: string;
  userId: string;
  placeId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
  };
};

export type RatingSummary = { average: number; count: number };

export type PlaceSummary = {
  id: string;
  osmId: string | null;
  name: string;
  description: string;
  category: string;
  subtype: string | null;
  address: string | null;
  latitude: string;
  longitude: string;
  cityId: string;
  createdAt: string;
  updatedAt: string;
  cityVerseScore?: number;
  city: {
    id: string;
    name: string;
    country: string;
    timezone?: string;
  };
};

export type PlacesResponse = {
  data: PlaceSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CityPlacesResponse = {
  city: Pick<CitySummary, "id" | "name" | "timezone"> & { latitude: string; longitude: string };
  data: PlaceSummary[];
  categories: string[];
  subtypes: Array<{ category: string; value: string }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
  filters: {
    category: string | null;
    subtype: string | null;
    search: string | null;
    sort: string;
  };
};

export type MapPlace = { id: string; name: string; category: string; subtype: string | null; latitude: string; longitude: string };
export type MapPlacesResponse = { city: { id: string; name: string; latitude: string; longitude: string }; data: MapPlace[]; limit: number; truncated: boolean };

export async function getMapPlaces(cityId: string, bounds: { north: number; south: number; east: number; west: number; category?: string }): Promise<MapPlacesResponse> {
  const params = new URLSearchParams({ north: String(bounds.north), south: String(bounds.south), east: String(bounds.east), west: String(bounds.west), limit: "300" });
  if (bounds.category) params.set("category", bounds.category);
  const res = await fetch(`${API_URL}/cities/${cityId}/map/places?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load map places");
  return res.json();
}

export async function getCities(
  page = 1,
  limit = 12,
): Promise<CitiesResponse> {
  const res = await fetch(
    `${API_URL}/cities?page=${page}&limit=${limit}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch cities");
  }

  return res.json();
}


export async function getFeaturedCities(): Promise<FeaturedCity[]> {
  const res = await fetch(
    `${API_URL}/cities/featured`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(
      "Failed to fetch featured cities",
    );
  }

  return res.json();
}


export async function getCity(id: string) {
  const res = await fetch(`${API_URL}/cities/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch city");
  }

  return res.json();
}

export async function getCityPlaces(
  id: string,
  page = 1,
  limit = 24,
  query: PlacesQuery = {},
): Promise<CityPlacesResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  params.set("offset", String(Math.max(0, (page - 1) * limit)));

  Object.entries(query).forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });

  const res = await fetch(
    `${API_URL}/cities/${id}/places?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch city places");
  }

  return res.json();
}


export type PlacesQuery = {
  city?: string;
  category?: string;
  subtype?: string;
  search?: string;
  sort?: string;
};

export async function getPlaces(
  page = 1,
  limit = 24,
  query: PlacesQuery = {},
): Promise<PlacesResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  Object.entries(query).forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });

  const res = await fetch(
    `${API_URL}/places?${params.toString()}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch places");
  }

  return res.json();
}

export async function getPlaceFilters(city?: string) {
  const params = city ? `?city=${encodeURIComponent(city)}` : "";
  const res = await fetch(`${API_URL}/places/filters${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch place filters");
  }

  return res.json() as Promise<{
    categories: string[];
    subtypes: Array<{ category: string; value: string }>;
  }>;
}


export async function getPlace(id: string) {
  const res = await fetch(`${API_URL}/places/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch place");
  }

  return res.json();
}


export async function getReviews(
  placeId: string,
): Promise<Review[]> {
  const res = await fetch(
    `${API_URL}/reviews/${placeId}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch reviews");
  }

  return res.json();
}


export async function createReview(data: {
  rating: number;
  comment: string;
  placeId: string;
}): Promise<Review> {

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("cityverse_token")
      : null;

  if (!token) {
    throw new Error("Please login before writing a review");
  }

  const res = await fetch(
    `${API_URL}/reviews`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(
      error?.message || "Failed to create review",
    );
  }

  return res.json();
}

async function authorizedRequest(path: string, init: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("cityverse_token") : null;
  if (!token) throw new Error("Please login first");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function getRatingSummary(placeId: string): Promise<RatingSummary> {
  const res = await fetch(`${API_URL}/ratings/${placeId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch ratings");
  return res.json();
}

export async function ratePlace(placeId: string, rating: number): Promise<RatingSummary> {
  const res = await authorizedRequest("/ratings", { method: "POST", body: JSON.stringify({ placeId, rating }) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Failed to save rating");
  return res.json();
}

export async function updateReview(id: string, data: { rating: number; comment: string; placeId: string }) {
  const res = await authorizedRequest(`/reviews/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Failed to update review");
  return res.json() as Promise<Review>;
}

export async function deleteReview(id: string) {
  const res = await authorizedRequest(`/reviews/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Failed to delete review");
}


export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResponse> {

  const res = await fetch(
    `${API_URL}/auth/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(
      error?.message || "Registration failed",
    );
  }

  return res.json();
}


export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResponse> {

  const res = await fetch(
    `${API_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(
      error?.message || "Invalid email or password",
    );
  }

  return res.json();
}
