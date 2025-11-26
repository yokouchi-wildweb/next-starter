// src/features/sampleTag/entities/model.ts

export type SampleTag = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
