// src/features/foo/entities/model.ts

export type Foo = {
  id: string;
  filesize: number | null;
  width: number | null;
  media: string | null;
  mimetype: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
