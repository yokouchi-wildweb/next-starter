// src/app/api/wallet/purchase/[id]/bank-transfer/judge-image/route.ts
//
// 自社銀行振込（inhouse プロバイダ）の振込明細画像を AI が事前判定するエンドポイント。
// ユーザーが /wallet/[slug]/purchase/bank-transfer/[id] 画面で「判定する」を押した時に呼ばれる。
//
// 判定の合否（passed）はサーバー側で確定し、purchase_requests.metadata に永続化する。
// /confirm エンドポイントはこの保存値で合否を検証する（クライアント申告は信用しない）。
// purchase_request の status は変更しない。実際の振込完了申告は /confirm 側で行う。
//
// ストリクトモード（paymentConfig.bankTransfer.aiImageJudgmentStrictMode=true）:
// 明細内で「振込人名・名前の前後の識別数字・振込金額」の 3 点が確認できなければ不合格。
// 期待値はサーバー側で purchase_request（provider_order_id / payment_amount）から渡す。
//
// レート制限（ユーザー単位）:
// - 直近15分: 失敗3回まで（4回目以降ブロック）。成功はカウントしない
// - 直近24時間: 試行30回まで（31回目以降ブロック）。成功・失敗いずれもカウント
// - Anthropic API エラー（タイムアウト・5xx 等）はいずれにもカウントしない（ユーザー責任ではないため）

import { NextResponse } from "next/server";

import { getBankTransferConfig } from "@/config/app/payment.config";
import {
  checkBankTransferReceipt,
  type SupportedImageMediaType,
} from "@/lib/aiVision";
import { createApiRoute } from "@/lib/routeFactory";
import { isBankTransferJudgmentPassed } from "@/features/core/purchaseRequest/constants/bankTransferJudgment";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import {
  checkJudgmentRateLimit,
  getJudgmentRateLimitStatus,
  recordAttempt,
  recordFailure,
  type JudgmentRateLimitStatus,
} from "@/features/core/rateLimit/services/server/wrappers/judgmentRateLimit";

type Params = { id: string };

/** Anthropic Vision が受け付ける MIME タイプ */
const SUPPORTED_MEDIA_TYPES: readonly SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** 1画像あたりの最大サイズ（Anthropic 推奨上限）。 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/** クライアントが UI に出すために必要な残量情報の serialize 形式。 */
function serializeRateLimit(status: JudgmentRateLimitStatus) {
  return {
    remainingFailures15m: status.remainingFailures15m,
    remainingAttempts24h: status.remainingAttempts24h,
    resetAt15m: status.resetAt15m?.toISOString() ?? null,
    resetAt24h: status.resetAt24h?.toISOString() ?? null,
  };
}

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/wallet/purchase/[id]/bank-transfer/judge-image",
    // 外部 AI API を消費するため write 扱い（デモユーザーはスキップ → サンドボックスで確認可能）
    operationType: "write",
    access: "custom",
  },
  async (req, { params, session }) => {
    const { id } = params;

    const bankTransferConfig = getBankTransferConfig();

    // 防御的チェック: フラグが false の場合は AI 判定を提供しない。
    // UI 側でもセクション自体を非表示にしているが、API 直叩きの保険として 503 を返す。
    if (!bankTransferConfig.aiImageJudgmentEnabled) {
      return NextResponse.json(
        { message: "現在この機能はご利用いただけません。" },
        { status: 503 },
      );
    }

    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }
    if (!id) {
      return NextResponse.json(
        { message: "リクエスト ID が指定されていません。" },
        { status: 400 },
      );
    }

    // 所有権検証: 存在 + 自分の購入リクエストか。404 で同一視して秘匿
    const purchaseRequest = await purchaseRequestService.get(id);
    if (!purchaseRequest || purchaseRequest.user_id !== session.userId) {
      return NextResponse.json(
        { message: "対象の購入リクエストが見つかりません。" },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "file フィールドに画像を添付してください" },
        { status: 400 },
      );
    }

    if (!isSupportedMediaType(file.type)) {
      return NextResponse.json(
        {
          message: `対応していない画像形式です（${file.type || "unknown"}）。jpeg/png/gif/webp のいずれかをご利用ください`,
        },
        { status: 415 },
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { message: "画像サイズが大きすぎます（最大5MB）" },
        { status: 413 },
      );
    }

    // レート制限事前チェック（カウントは増やさない）
    const limitCheck = await checkJudgmentRateLimit(session.userId);
    if (!limitCheck.ok) {
      const message =
        limitCheck.blockedBy === "daily"
          ? "本日の判定回数の上限に達しました。明日以降に再度お試しください。"
          : "判定の失敗が短時間に集中しています。しばらく時間を置いてから再度お試しください。";
      return NextResponse.json(
        {
          message,
          blockedBy: limitCheck.blockedBy,
          resetAt: limitCheck.resetAt.toISOString(),
          rateLimit: serializeRateLimit(limitCheck.status),
        },
        { status: 429 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

    // ストリクトモード: 識別数字（provider_order_id）と振込金額を期待値として渡し、
    // 振込人名・識別数字・金額の 3 点が明細内で確認できなければ不合格にする。
    // provider_order_id 未生成（想定外のデータ不整合）の場合は期待値照合ができないため、
    // 通常モードにフォールバックして警告を残す。
    const identifier = purchaseRequest.provider_order_id ?? "";
    const useStrict = bankTransferConfig.aiImageJudgmentStrictMode && identifier !== "";
    if (bankTransferConfig.aiImageJudgmentStrictMode && identifier === "") {
      console.warn(
        `[judge-image] strict mode requested but provider_order_id is missing (purchaseRequest=${purchaseRequest.id}). Falling back to normal judgment.`,
      );
    }

    let judgment;
    try {
      judgment = await checkBankTransferReceipt({
        imageBase64,
        mediaType: file.type,
        strict: useStrict
          ? {
              expectedIdentifier: identifier,
              expectedAmount: purchaseRequest.payment_amount,
            }
          : undefined,
      });
    } catch (e) {
      // Anthropic API エラー（タイムアウト・5xx 等）はインフラ起因なのでカウントしない。
      // ユーザーには「判定不能」を伝えて再試行を促す。
      console.error("[judge-image] Anthropic API error:", e);
      const currentStatus = await getJudgmentRateLimitStatus(session.userId);
      return NextResponse.json(
        {
          message:
            "判定サービスに一時的な問題が発生しました。しばらく経ってから再度お試しください。",
          rateLimit: serializeRateLimit(currentStatus),
        },
        { status: 503 },
      );
    }

    // 合否はサーバー側で確定し、purchase_requests.metadata に永続化する。
    // 振込完了申告（confirm）はこの保存値で検証するため、クライアントが判定結果を
    // 偽って申告しても即時付与は受けられない（未判定 = 不合格扱い）。
    const passed = isBankTransferJudgmentPassed(judgment);
    await purchaseRequestService.recordBankTransferJudgment({
      purchaseRequestId: purchaseRequest.id,
      userId: session.userId,
      judgment: {
        passed,
        isLikelyBankTransfer: judgment.isLikelyBankTransfer,
        confidence: judgment.confidence,
        imageType: judgment.imageType,
        reason: judgment.reason,
        strictChecks: judgment.strictChecks ?? null,
        strictMode: useStrict,
        judgedAt: new Date().toISOString(),
      },
    });

    // 24時間カウンタは成功・失敗いずれもインクリメント。
    // 15分カウンタは失敗時のみ。
    await recordAttempt(session.userId);
    if (!judgment.isLikelyBankTransfer) {
      await recordFailure(session.userId);
    }
    const finalStatus = await getJudgmentRateLimitStatus(session.userId);

    return NextResponse.json({
      ...judgment,
      passed,
      rateLimit: serializeRateLimit(finalStatus),
    });
  },
);

function isSupportedMediaType(value: string): value is SupportedImageMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}
