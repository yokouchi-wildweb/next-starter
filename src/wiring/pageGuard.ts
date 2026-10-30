// src/wiring/pageGuard.ts
//
// ページの守りの設定済みの作り手。lib/pageGuard の汎用版に、利用者の束(auth の pageGuardUserDeps)と
// setup 誘導の判定(auth の hasUserForAccess)を結ぶ。呼ぶのは root の src/app/guard.ts だけ
// (子の guard.ts は親の extend で作る)。設計: src/wiring/README.md, src/lib/pageGuard/README.md

import { hasUserForAccess } from "@/features/core/auth/services/server/authorization";
import { pageGuardUserDeps } from "@/features/core/auth/services/server/pageGuardUserDeps";
import { createPageGuard } from "@/lib/pageGuard";

/** root の範囲を方針から作る(src/app/guard.ts が 1 回だけ呼ぶ) */
export const defineRootGuard = createPageGuard({ ...pageGuardUserDeps, hasUserForAccess });
