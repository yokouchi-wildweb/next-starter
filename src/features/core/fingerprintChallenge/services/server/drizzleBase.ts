// src/features/core/fingerprintChallenge/services/server/drizzleBase.ts

import { FingerprintChallengeTable } from "@/features/core/fingerprintChallenge/entities/drizzle";
import {
  FingerprintChallengeCreateSchema,
  FingerprintChallengeUpdateSchema,
  type FingerprintChallengeWriteInput,
} from "@/features/core/fingerprintChallenge/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

// 監査は CRUD 自動記録ではなく、challengeService の各 wrapper が意味づけした
// action (fingerprint.challenge.issued / submitted / reviewed / canceled) で
// 手動記録する。自動監査を併用すると同一遷移が二重記録されるため付けない。
const fingerprintChallengeOptions: DrizzleCrudServiceOptions<FingerprintChallengeWriteInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => FingerprintChallengeCreateSchema.parse(data),
  parseUpdate: (data) => FingerprintChallengeUpdateSchema.parse(data),
};

export const fingerprintChallengeBase = createCrudService(
  FingerprintChallengeTable,
  fingerprintChallengeOptions,
);
