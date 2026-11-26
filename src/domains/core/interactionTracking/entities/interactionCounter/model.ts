// src/domains/core/interactionTracking/entities/interactionCounter/model.ts

export type InteractionCounter = {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  shard: number;
  count: number;
  firstOccurredAt: Date;
  lastOccurredAt: Date;
};
