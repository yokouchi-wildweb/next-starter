// src/domains/core/milestone/entities/milestone/model.ts

export type Milestone = {
  id: string;
  user_id: string;
  milestone_key: string;
  achieved_at: Date;
  metadata: any | null;
  createdAt: Date | null;
};
