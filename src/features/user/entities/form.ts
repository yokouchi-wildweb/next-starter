// src/features/user/entities/form.ts

import { z } from "zod";
import {
  AdminUserOpotionalSchema,
  AdminUserSchema,
  GeneralUserOptionalSchema,
  GeneralUserSchema,
} from "./schema";

export type GeneralUserFields = z.infer<typeof GeneralUserSchema>;

export type GeneralUserOptionalFields = z.infer<typeof GeneralUserOptionalSchema>;

export type AdminUserFields = z.infer<typeof AdminUserSchema>;

export type AdminUserOptionalFields = z.infer<typeof AdminUserOpotionalSchema>;

