// src/features/sample/services/server/wrappers/duplicate.ts

import { createStorageAwareDuplicate } from "@/lib/storage/domainIntegration";
import { base } from "../drizzleBase";

export const duplicate = createStorageAwareDuplicate(base, "sample");
