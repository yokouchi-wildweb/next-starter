// src/features/foo/entities/model.ts

export type Foo = {
  id: string;
  sample_category_id: string;
  name: string;
  type: 'apple' | 'orange';
  num: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
