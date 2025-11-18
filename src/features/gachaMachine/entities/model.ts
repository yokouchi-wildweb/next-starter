// src/features/gachaMachine/entities/model.ts

export type GachaMachine = {
  id: string;
  name: string;
  main_image_url: string | null;
  play_cost: number;
  sale_start_at: Date | null;
  sale_end_at: string | null;
  daily_limit: number | null;
  user_limit: number | null;
  play_button_type: string[];
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
