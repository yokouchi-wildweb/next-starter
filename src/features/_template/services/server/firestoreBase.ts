// src/features/__domain__/services/server/firestoreBase.ts

import { createCrudService } from "@/lib/crud/firestore";
import type { __Domain__ } from "@/features/__domain__/entities";

export const base = createCrudService<__Domain__>("__domains__", __serviceOptions__);
