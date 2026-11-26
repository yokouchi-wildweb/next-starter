// src/domains/core/rateLimit/entities/rateLimit/model.ts

export type RateLimit = {
  id: string;
  count: number;
  window_start: Date;
  expires_at: Date;
};
