// src/features/__domain__/services/server/wrappers/remove.ts

import { createStorageAwareRemove } from "@/lib/crud/storageIntegration";
import { base } from "../__serviceBase__";

export const remove = createStorageAwareRemove(base, "__domain__");
