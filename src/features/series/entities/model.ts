// src/features/series/entities/model.ts

import type { InferInsertModel } from "drizzle-orm";
import type { BaseEntity } from "@/types/entity";
import { SeriesTable } from "./drizzle";

export type Series = BaseEntity & {
  titleId: string;
  name: string;
  description: string | null;
  releaseDate: string | null;
};

