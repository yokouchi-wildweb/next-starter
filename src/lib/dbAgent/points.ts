// src/lib/dbAgent/points.ts
// 型だけの入口(D33、注文 37): この地区の点の約束の型だけを出す。差す側の項目はここだけを型として読む(値は無い)。点の宣言: ./extensionPoints.ts

export type { AgentToolDefinition } from "@/lib/ai";
export type { DbAgentPromptFragment, DbAgentSystemSuffixProvider } from "./prompt";
