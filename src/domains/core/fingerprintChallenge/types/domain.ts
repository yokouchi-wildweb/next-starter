// src/domains/core/fingerprintChallenge/types/domain.ts
// どの表にも属さないドメイン全体の型(entities/<登録名>/ にはその表の物だけ)

import type { IssueChallengeSchema, MarkChallengeNotifiedSchema, SubmitChallengeSchema } from "../constants/domain";
import type { z } from "zod";

export type MarkChallengeNotifiedInput = z.infer<typeof MarkChallengeNotifiedSchema>;
export type IssueChallengeInput = z.infer<typeof IssueChallengeSchema>;
export type SubmitChallengeInput = z.infer<typeof SubmitChallengeSchema>;
