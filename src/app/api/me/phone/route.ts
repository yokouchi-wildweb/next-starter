// src/app/api/me/phone/route.ts

import { NextResponse } from "next/server";

import { gate } from "@/featureGate";
import { updateOwnPhoneNumber } from "@/features/core/user/services/server/phoneNumber";
import { isPhoneNumberInputOpen } from "@/features/core/user/utils/accountItems";
import { createMeRoute } from "@/wiring/apiRoute";
import { DomainError } from "@/lib/errors";

/**
 * 本人の電話番号を SMS 認証なしで登録・変更・消す(body { phoneNumber: E.164 | null }、消すのは null)
 * PATCH /api/me/phone
 * 受け付けるのは user の設定 account.editableItems に phone があり、かつ SMS 認証の機能 phoneVerification が閉のときだけ。
 * それ以外は 404(SMS 認証が開なら番号は /api/phone-verification の手順でだけ変える、L1.39)
 */
export const PATCH = createMeRoute(
  {
    operation: "PATCH /api/me/phone",
    operationType: "write",
  },
  async (req, { user }) => {
    if (!isPhoneNumberInputOpen(gate.enabled("phoneVerification"))) {
      throw new DomainError("Not Found", { status: 404 });
    }
    const json = await req.json();
    const result = await updateOwnPhoneNumber({ userId: user.userId, input: json });
    return NextResponse.json({
      phoneNumber: result.phoneNumber,
      phoneVerifiedAt: result.phoneVerifiedAt ? result.phoneVerifiedAt.toISOString() : null,
    });
  },
);
