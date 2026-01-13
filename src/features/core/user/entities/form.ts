// src/features/user/entities/form.ts

import { z } from "zod";
import { UserCoreSchema, UserOptionalSchema } from "./schema";

export type UserFields = z.infer<typeof UserCoreSchema>;

export type UserOptionalFields = z.infer<typeof UserOptionalSchema>;

