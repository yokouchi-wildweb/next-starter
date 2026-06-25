// src/features/core/userCounter/entities/model.ts

export type UserCounter = {
  id: string;
  user_id: string;
  counter_key: string;
  count: number;
  first_occurred_at: Date;
  last_occurred_at: Date;
};
