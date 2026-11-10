// src/app/api/me/messaging/endpoints/route.ts
//
// 本人の端末の帳簿(プッシュの購読トークン・電話番号など)。利用者は user.userId に束ねる(client の id は信じない)。
// GET 一覧 / POST 登録(body { channel, address, kind?, metadata? })/ DELETE ?id= 本人の行を消す
// 機能の門は持たない(送る口と同じく常に開)。受け付ける経路は帳簿を読む経路だけ(messaging の README「端末の帳簿」)

import { NextResponse } from "next/server";

import { messagingService } from "@/features/core/messaging/services/server";
import { DomainError } from "@/lib/errors";
import { createMeRoute } from "@/wiring/apiRoute";

export const GET = createMeRoute(
  { operation: "GET /api/me/messaging/endpoints", operationType: "read" },
  async (_req, { user }) => {
    const endpoints = await messagingService.listEndpoints(user.userId);
    return NextResponse.json({ endpoints });
  },
);

export const POST = createMeRoute(
  { operation: "POST /api/me/messaging/endpoints", operationType: "write" },
  async (req, { user }) => {
    const body = await req.json().catch(() => null);
    const endpoint = await messagingService.registerEndpoint(user.userId, body);
    return NextResponse.json({ endpoint });
  },
);

export const DELETE = createMeRoute(
  { operation: "DELETE /api/me/messaging/endpoints", operationType: "write" },
  async (req, { user }) => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new DomainError("id を指定してください", { status: 400 });
    await messagingService.removeEndpoint(user.userId, id);
    return NextResponse.json({ ok: true });
  },
);
