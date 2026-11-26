// src/domains/core/userAcquisition/types/domain.ts
// どの表にも属さないドメイン全体の型(entities/<登録名>/ にはその表の物だけ)

import type { AttributionCookiePayloadSchema, AttributionCookieTouchSchema } from "../constants/domain";
import type { z } from "zod";

export type AttributionCookieTouch = z.infer<typeof AttributionCookieTouchSchema>;
export type AttributionCookiePayload = z.infer<typeof AttributionCookiePayloadSchema>;
