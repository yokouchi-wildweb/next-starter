// src/features/core/purchaseRequest/components/BankTransferInstructionPage/ImageJudgmentSection.tsx
//
// ③ 振込明細画像の AI 事前判定セクション。
// ② で添付された画像（File）を /api/wallet/purchase/[id]/bank-transfer/judge-image に POST し、
// Claude Vision の判定結果（承認候補 / 不承認候補 + 確信度 + 判定根拠）を表示する。
//
// 判定結果が「承認候補 かつ confidence >= JUDGMENT_PASS_THRESHOLD」のときのみ
// 親側の Step④ ボタンが活性化する。判定結果は画像差し替え時に親側でリセットされる。
//
// ストリクトモード時はレスポンスに strictChecks（振込人名・識別数字・金額の個別合否）が
// 付与され、チェックリストとして表示する。通過判定自体はサーバー側で合算済みのため
// isJudgmentPassed のロジックは共通。
//
// レート制限:
// - 直近15分: 失敗3回まで、4回目で 429。成功はカウントしない
// - 直近24時間: 試行30回まで、31回目で 429。成功・失敗いずれもカウント
// - 残り回数はサーバー側で管理。UI には 15分カウンタの残量のみを表示する（24時間は内部用）
// - 限界到達時は判定ボタンを無効化して「しばらく時間を置いてから」メッセージを表示

"use client";

import { useEffect, useState } from "react";
import axios, { AxiosError } from "axios";
import { Brain, CircleCheck, CircleX, RefreshCw } from "lucide-react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para, Span } from "@/components/TextBlocks";

import { circledNumber } from "./stepNumber";

/**
 * サーバー側 (judgmentRateLimit.ts) と同期する制限値。
 * 表示用にのみ使用。実際のゲートはサーバー側で行われる。
 */
const LIMIT_15M_FAILURES = 3;

export type RateLimitInfo = {
  /** 直近15分の残り失敗許容回数 */
  remainingFailures15m: number;
  /** 直近24時間の残り試行可能回数（UI には出さないが 429 判断に使う） */
  remainingAttempts24h: number;
  resetAt15m: string | null;
  resetAt24h: string | null;
};

/**
 * ストリクトモード時の必須 3 点チェックの個別結果。
 * サーバー側 (lib/aiVision) の BankTransferStrictChecks と同期。
 */
export type StrictChecks = {
  /** 振込人名が明細内で読み取れたか */
  senderNameConfirmed: boolean;
  /** 振込人名の前後どちらかに識別数字があるか */
  identifierConfirmed: boolean;
  /** 振込金額が一致したか */
  amountConfirmed: boolean;
  /** 読み取れた振込人名（読み取れなかった場合は null） */
  detectedSenderName: string | null;
};

export type JudgmentResult = {
  isLikelyBankTransfer: boolean;
  confidence: number;
  imageType: "photo" | "screenshot" | "other";
  reason: string;
  /** ストリクトモード時のみ付与される */
  strictChecks?: StrictChecks;
  rateLimit: RateLimitInfo;
};

/** 通過判定の最小確信度。これ未満の承認候補は Step④ を活性化しない。 */
export const JUDGMENT_PASS_THRESHOLD = 35;

/** 親側で Step④ の活性条件として参照するヘルパー。 */
export function isJudgmentPassed(result: JudgmentResult | null): boolean {
  if (!result) return false;
  return result.isLikelyBankTransfer && result.confidence >= JUDGMENT_PASS_THRESHOLD;
}

type Props = {
  /** 親が動的に決定するステップ番号 (例: 3) */
  step: number;
  /** purchase_request の ID（判定 API のパスに使用） */
  requestId: string;
  /** 前ステップで選択された画像 File。null = 未添付（判定ボタン非活性） */
  file: File | null;
  /** 直近の判定結果。null = 未判定 */
  result: JudgmentResult | null;
  /** 判定結果の更新（再判定の前にも null で呼んでクリア） */
  onResultChange: (result: JudgmentResult | null) => void;
  /** ストリクトモード（振込人名・識別数字・金額の 3 点確認）の有効化フラグ。説明文の切替に使用 */
  strictMode: boolean;
};

export function ImageJudgmentSection({
  step,
  requestId,
  file,
  result,
  onResultChange,
  strictMode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 直近の rate limit 情報。429 を受けた時 / 判定が完了した時の両方で更新される。
  // result が null になっても保持して残量表示に使う（画像差し替え後でも見せる）。
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  // 15分ウィンドウのリセットまでの相対時刻表示用（30秒ごとに更新）
  const resetText15m = useRelativeTimeFromNow(rateLimit?.resetAt15m ?? null);

  const handleJudge = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    onResultChange(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post<JudgmentResult>(
        `/api/wallet/purchase/${requestId}/bank-transfer/judge-image`,
        formData,
      );
      onResultChange(res.data);
      setRateLimit(res.data.rateLimit);
    } catch (e) {
      const { message, rateLimit: limitFromError } = extractError(e);
      setError(message);
      if (limitFromError) {
        setRateLimit(limitFromError);
      }
    } finally {
      setLoading(false);
    }
  };

  const isRateLimited =
    rateLimit !== null &&
    (rateLimit.remainingFailures15m === 0 || rateLimit.remainingAttempts24h === 0);
  const buttonShouldShow =
    !!file && (loading || result === null || !result.isLikelyBankTransfer);

  // 15分残量ヘッダー: 失敗が1回でも発生したときだけ表示（満タンでは出さない）
  const show15mHeader =
    rateLimit !== null && rateLimit.remainingFailures15m < LIMIT_15M_FAILURES;
  const is15mExhausted = rateLimit !== null && rateLimit.remainingFailures15m === 0;

  return (
    <Block padding="md" className="rounded-lg border border-border bg-card">
      <Stack space={3}>
        <Span weight="semiBold" size="md">
          {circledNumber(step)} 画像の判定
        </Span>

        {show15mHeader ? (
          <Flex justify="center">
            <Para size="xs" tone={is15mExhausted ? "destructive" : "muted"} align="center">
              残り判定回数: {rateLimit!.remainingFailures15m} / {LIMIT_15M_FAILURES}
              {is15mExhausted && resetText15m ? `（${resetText15m}後に回復）` : null}
            </Para>
          </Flex>
        ) : null}

        <Para size="sm" tone="muted">
          {strictMode
            ? "添付画像から「振込人名」「名前の前後の識別数字」「振込金額」の3点を確認します。すべて確認できないと申告に進めません。"
            : "添付画像の妥当性を検証します。"}
        </Para>

        {!file ? (
          <Flex justify="center">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full max-w-xs"
              disabled
            >
              先に画像を添付してください
            </Button>
          </Flex>
        ) : (
          <Stack space={3}>
            {/* 検証完了（承認候補）後は判定ボタンを非表示。不承認 / 未判定時のみ表示。 */}
            {buttonShouldShow && (
              <Flex justify="center">
                <Button
                  type="button"
                  variant={result === null ? "default" : "outline"}
                  size="lg"
                  className="w-full max-w-xs"
                  onClick={handleJudge}
                  disabled={loading || isRateLimited}
                >
                  {renderButtonContent({ loading, result, isRateLimited })}
                </Button>
              </Flex>
            )}

            {error ? (
              <Para tone="destructive" size="sm">
                {error}
              </Para>
            ) : null}

            {result ? <ResultView result={result} /> : null}
          </Stack>
        )}
      </Stack>
    </Block>
  );
}

function renderButtonContent({
  loading,
  result,
  isRateLimited,
}: {
  loading: boolean;
  result: JudgmentResult | null;
  isRateLimited: boolean;
}) {
  if (loading) {
    return (
      <>
        <Spinner className="h-4 w-4" />
        判定中...
      </>
    );
  }
  if (isRateLimited) {
    return "しばらく時間を置いてからお試しください";
  }
  if (result === null) {
    return (
      <>
        <Brain className="h-4 w-4" />
        判定する
      </>
    );
  }
  return (
    <>
      <RefreshCw className="h-4 w-4" />
      もう一度判定する
    </>
  );
}

function ResultView({ result }: { result: JudgmentResult }) {
  const isPassed = result.isLikelyBankTransfer;
  return (
    <Stack space={3} className="rounded-md border border-border bg-background p-3">
      <Flex justify="center">
        <SoftBadge variant={isPassed ? "success" : "destructive"} size="md">
          {isPassed ? "検証完了" : "不承認"}
        </SoftBadge>
      </Flex>

      <ResultBar isPassed={isPassed} confidence={result.confidence} />

      {result.strictChecks ? <StrictCheckList checks={result.strictChecks} /> : null}

      <Para size="sm">{result.reason}</Para>
    </Stack>
  );
}

/**
 * ストリクトモードの必須 3 点チェック結果の一覧表示。
 * どの項目が原因で不合格になったかをユーザーが把握できるようにする。
 */
function StrictCheckList({ checks }: { checks: StrictChecks }) {
  const items: { label: string; confirmed: boolean }[] = [
    { label: "振込人名の確認", confirmed: checks.senderNameConfirmed },
    { label: "識別数字の確認（名前の前後）", confirmed: checks.identifierConfirmed },
    { label: "振込金額の一致", confirmed: checks.amountConfirmed },
  ];

  return (
    <Stack space={1}>
      {items.map(({ label, confirmed }) => (
        <Flex key={label} gap="xs" align="center">
          {confirmed ? (
            <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <CircleX aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <Span size="sm" tone={confirmed ? "default" : "destructive"}>
            {label}
          </Span>
        </Flex>
      ))}
    </Stack>
  );
}

/**
 * 結果バー。
 * - 承認候補: 「確信度」緑〜赤グラデ（伸びるほど好結果）
 * - 不承認候補: 「不正確信度」赤系（伸びるほど却下の確度が高い）
 *
 * ユーザーは「バーが伸びる＝良いこと」と直感的に捉えがちなので、
 * 不承認時はラベルと色を反転して認知ギャップを生まないようにしている。
 */
function ResultBar({ isPassed, confidence }: { isPassed: boolean; confidence: number }) {
  if (isPassed) {
    const tone =
      confidence >= 70
        ? "bg-success"
        : confidence >= 40
          ? "bg-warning"
          : "bg-destructive";
    return (
      <div>
        <Flex justify="between">
          <Span tone="muted" size="sm">
            確信度
          </Span>
          <Span weight="medium" size="sm">
            {confidence} / 100
          </Span>
        </Flex>
        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
          <div
            className={`h-full transition-all ${tone}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    );
  }
  const tone =
    confidence >= 70
      ? "bg-destructive"
      : confidence >= 40
        ? "bg-destructive/70"
        : "bg-destructive/40";
  return (
    <div>
      <Flex justify="between">
        <Span tone="destructive" size="sm">
          不正確信度
        </Span>
        <Span weight="medium" size="sm" tone="destructive">
          {confidence} / 100
        </Span>
      </Flex>
      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
        <div
          className={`h-full transition-all ${tone}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}

/**
 * ISO 文字列から「約X分 / 約X時間」相対表記を生成。
 * 30秒ごとに再計算して鮮度を保つ。
 */
function useRelativeTimeFromNow(iso: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - now;
  if (diffMs <= 0) return "まもなく";
  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) return `約${minutes}分`;
  const hours = Math.ceil(minutes / 60);
  return `約${hours}時間`;
}

type ExtractedError = {
  message: string;
  rateLimit: RateLimitInfo | null;
};

function extractError(e: unknown): ExtractedError {
  if (e instanceof AxiosError) {
    const data = e.response?.data as
      | { message?: string; rateLimit?: RateLimitInfo }
      | undefined;
    return {
      message: data?.message ?? e.message,
      rateLimit: data?.rateLimit ?? null,
    };
  }
  if (e instanceof Error) {
    return { message: e.message, rateLimit: null };
  }
  return { message: "判定に失敗しました", rateLimit: null };
}
