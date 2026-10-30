// src/app/guard.ts
//
// root の範囲(全ページを覆う)。子の範囲の guard.ts は最寄りの親の extend で作る(親子 AND、狭めるだけ)。
// 方針の値は export しない(export は guard / createLoader / extend の 3 つ)。設計: src/lib/pageGuard/README.md

import "server-only";

import { defineRootGuard } from "@/wiring/pageGuard";

export const { guard, createLoader, extend } = defineRootGuard({ access: "public" });
