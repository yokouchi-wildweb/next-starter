// src/features/coupon/services/server/wrappers/remove.ts

import { createStorageAwareRemove } from "@/lib/crud/storageIntegration";
import { base } from "../drizzleBase";

export const remove = createStorageAwareRemove(base, "coupon");
