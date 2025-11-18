// src/features/gachaMachine/entities/form.ts

import { z } from "zod";
import { GachaMachineCreateSchema, GachaMachineUpdateSchema } from "./schema";

export type GachaMachineCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type GachaMachineCreateFields = z.infer<typeof GachaMachineCreateSchema> & GachaMachineCreateAdditional;

export type GachaMachineUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type GachaMachineUpdateFields = z.infer<typeof GachaMachineUpdateSchema> & GachaMachineUpdateAdditional;
