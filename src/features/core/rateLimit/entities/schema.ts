// src/features/rateLimit/entities/schemaRegistry.ts

import { z } from "zod";

export const RateLimitBaseSchema = z.object({

});

export const RateLimitCreateSchema = RateLimitBaseSchema;

export const RateLimitUpdateSchema = RateLimitBaseSchema.partial();
