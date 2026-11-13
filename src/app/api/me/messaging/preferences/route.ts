// src/app/api/me/messaging/preferences/route.ts
//
// 本人の連絡の好み(配信停止)。利用者は user.userId に束ねる(client の id は信じない)。
// GET 表(経路 > 種別の枠 > グループ > 種類、広い停止の状態 categories・channels[].optedOut・kinds・allOptedOut)/ PATCH 1 つの変更 → 変えた後の表
//   body { category, channel, optedOut }(1 マス / 種類まるごとは channel '*' / 経路まるごとは category '*' / 全体はどちらも '*')
//   か { kind, optedOut }(種別まるごと)。source は本文から受けない(いつも user)
// 門 messagingPreferences が閉なら 404(ワンクリックの受け口 /api/messaging/unsubscribe は門に関わらず開)

import { NextResponse } from "next/server";

import { gate } from "@/featureGate";
import { messagingService } from "@/features/core/messaging/services/server";
import { createMeRoute } from "@/wiring/apiRoute";

export const GET = createMeRoute(
  { operation: "GET /api/me/messaging/preferences", operationType: "read" },
  async (_req, { user }) => {
    gate.assert("messagingPreferences");
    const preferences = await messagingService.getMessagePreferences(user.userId);
    return NextResponse.json({ preferences });
  },
);

export const PATCH = createMeRoute(
  { operation: "PATCH /api/me/messaging/preferences", operationType: "write" },
  async (req, { user }) => {
    gate.assert("messagingPreferences");
    const body = await req.json().catch(() => null);
    const preferences = await messagingService.setMessagePreference(user.userId, body);
    return NextResponse.json({ preferences });
  },
);
