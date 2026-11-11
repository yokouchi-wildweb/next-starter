// src/features/core/messaging/services/server/preferences/schema.ts
//
// 好みを変える入力の zod。全体は category と channel のどちらも '*'。片方だけの '*' は受けない

import { z } from "zod";

import { MESSAGE_ALL } from "../../../entities/schema";

export const SetMessagePreferenceInputSchema = z
  .object({
    category: z.string().min(1).max(100),
    channel: z.string().min(1).max(100),
    optedOut: z.boolean(),
  })
  .strict()
  .refine((value) => (value.category === MESSAGE_ALL) === (value.channel === MESSAGE_ALL), {
    message: "全体の停止は category と channel のどちらも '*' にします",
  });
