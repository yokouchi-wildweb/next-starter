// src/domains/core/interactionTracking/entities/interactionEvent/model.ts

export type InteractionEvent = {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  source: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  retentionDays: number;
  createdAt: Date;
};
