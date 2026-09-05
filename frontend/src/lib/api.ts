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
  city: {
    id: string;
    name: string;
    country: string;
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
  city: Pick<CitySummary, "id" | "name">;
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
