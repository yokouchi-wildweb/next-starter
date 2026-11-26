// src/domains/core/fingerprintChallenge/services/server/fingerprintChallengeBase.ts

import { FingerprintChallengeTable } from "@/domains/core/fingerprintChallenge/entities/drizzle";
import {
  FingerprintChallengeCreateSchema,
  FingerprintChallengeUpdateSchema,
  type FingerprintChallengeWriteInput,
} from "@/domains/core/fingerprintChallenge/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

// 監査は CRUD 自動記録ではなく、challengeService の各 wrapper が意味づけした
// action (fingerprint.challenge.issued / submitted / reviewed / canceled) で
// 手動記録する。自動監査を併用すると同一遷移が二重記録されるため付けない。
const fingerprintChallengeOptions: CrudServiceOptions<FingerprintChallengeWriteInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => FingerprintChallengeCreateSchema.parse(data),
  parseUpdate: (data) => FingerprintChallengeUpdateSchema.parse(data),
};

export const fingerprintChallengeBase = createCrudService(
  FingerprintChallengeTable,
  fingerprintChallengeOptions,
);
