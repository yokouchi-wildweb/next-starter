// src/features/sampleCategory/entities/model.ts

export type SampleCategory = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
