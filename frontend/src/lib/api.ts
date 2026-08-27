const API_URL = "http://localhost:3001";

export type User = {
  id: string;
  email: string;
  name: string;
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


export async function getCities() {
  const res = await fetch(
    `${API_URL}/cities`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch cities");
  }

  return res.json();
}


export async function getFeaturedCities() {
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


export async function getPlaces() {
  const res = await fetch(`${API_URL}/places`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch places");
  }

  return res.json();
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
