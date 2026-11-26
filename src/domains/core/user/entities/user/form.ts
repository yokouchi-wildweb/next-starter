// src/domains/core/user/entities/user/form.ts

import { UserCoreSchema, UserOptionalSchema } from "./schema";
import { z } from "zod";

export type UserFields = z.infer<typeof UserCoreSchema>;
export type UserOptionalFields = z.infer<typeof UserOptionalSchema>;
