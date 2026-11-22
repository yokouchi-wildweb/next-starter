// src/domains/rateLimit/entities/model.ts

export type RateLimit = {
  id: string;
  count: number;
  window_start: Date;
  expires_at: Date;
};
