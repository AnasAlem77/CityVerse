export type RecommendationMode = 'city' | 'category' | 'nearby' | 'similar' | 'personalized';

export type RecommendationItem = {
  placeId: string;
  rank: number;
  score: number;
  reason: string;
};

export type RecommendationResponse = {
  mode: RecommendationMode;
  recommendations: RecommendationItem[];
  personalized: boolean;
  message: string;
};
