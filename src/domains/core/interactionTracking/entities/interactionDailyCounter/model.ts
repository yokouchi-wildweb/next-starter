// src/domains/core/interactionTracking/entities/interactionDailyCounter/model.ts

export type InteractionDailyCounter = {
  id: string;
  date: string;
  targetType: string;
  targetId: string;
  action: string;
  source: string;
  shard: number;
  count: number;
};
