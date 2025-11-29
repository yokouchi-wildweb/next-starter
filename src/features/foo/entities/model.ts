// src/features/foo/entities/model.ts

export type Foo = {
  id: string;
  name: string;
  filesize: number | null;
  media: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
