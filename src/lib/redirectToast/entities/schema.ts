// src/lib/redirectToast/entities/schema.ts

import { z } from "zod";

export const RedirectToastVariantSchema = z.enum(["message", "success", "info", "warning", "error"]);

export const RedirectToastSchema = z.object({
  variant: RedirectToastVariantSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.number().int().positive().optional(),
});

export type RedirectToastVariant = z.infer<typeof RedirectToastVariantSchema>;
export type RedirectToastDefinition = z.infer<typeof RedirectToastSchema>;
