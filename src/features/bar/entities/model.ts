// src/features/bar/entities/model.ts

export type Bar = {
  id: any;
  titleId: string | null;
  rarityId: string;
  tagIds?: string[];
  seriesIds?: string[];
  name: string;
  modelNumber: string | null;
  marketPrice: number | null;
  pointValue: number | null;
  cardType: 'real' | 'virtual' | null;
  state: 'active' | 'inactive' | null;
  description: string | null;
  mainImageUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

