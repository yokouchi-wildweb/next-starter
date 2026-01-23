// src/features/coupon/services/server/wrappers/duplicate.ts

import { createStorageAwareDuplicate } from "@/lib/crud/storageIntegration";
import { base } from "../drizzleBase";

export const duplicate = createStorageAwareDuplicate(base, "coupon");
