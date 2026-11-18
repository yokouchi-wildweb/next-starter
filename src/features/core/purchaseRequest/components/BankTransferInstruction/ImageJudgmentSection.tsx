// src/features/core/purchaseRequest/components/BankTransferInstruction/ImageJudgmentSection.tsx
//
// ③ 振込明細画像の AI 事前判定セクション。
// ② で添付された画像（File）を /api/wallet/purchase/[id]/bank-transfer/judge-image に POST し、
// Claude Vision の判定結果（承認候補 / 不承認候補 + 確信度 + 判定根拠）を表示する。
//
// 合否（passed）はサーバー側（judge-image API）で確定して返り、purchase_requests.metadata
// にも永続化される。申告時のサーバー検証はその保存値で行われるため、UI の passed は
// あくまで表示・活性制御用。判定結果は画像差し替え時に親側でリセットされる。
// 不承認でも親側の Step④ は「不承認のまま申告する」フローとして活性化する。
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
import { Brain, CircleCheck, CircleX, RefreshCw } from "lucide-react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";

import { useBankTransferImageJudge } from "@/features/core/purchaseRequest/hooks/useBankTransferImageJudge";
import type { JudgmentResult, StrictChecks } from "@/features/core/purchaseRequest/types/bankTransferJudgment";

import { circledNumber } from "./stepNumber";

/**
 * サーバー側 (judgmentRateLimit.ts) と同期する制限値。
 * 表示用にのみ使用。実際のゲートはサーバー側で行われる。
 */
const LIMIT_15M_FAILURES = 3;

/** 親側で判定通過の参照に使うヘルパー。合否はサーバーが返した passed をそのまま使う。 */
export function isJudgmentPassed(result: JudgmentResult | null): boolean {
  return result?.passed === true;
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
  // 直近の rate limit 情報は判定のフックが持つ。429 を受けた時 / 判定が完了した時の両方で更新され、
  // result が null になっても保持して残量表示に使う（画像差し替え後でも見せる）。
  const { judge, loading, error, rateLimit } = useBankTransferImageJudge(requestId);

  // 15分ウィンドウのリセットまでの相対時刻表示用（30秒ごとに更新）
  const resetText15m = useRelativeTimeFromNow(rateLimit?.resetAt15m ?? null);

  const handleJudge = async () => {
    if (!file || loading) return;
    onResultChange(null);
    const judged = await judge(file);
    if (judged) onResultChange(judged);
  };

  const isRateLimited =
    rateLimit !== null &&
    (rateLimit.remainingFailures15m === 0 || rateLimit.remainingAttempts24h === 0);
  const buttonShouldShow =
    !!file && (loading || result === null || !result.passed);

  // 15分残量ヘッダー: 失敗が1回でも発生したときだけ表示（満タンでは出さない）
  const show15mHeader =
    rateLimit !== null && rateLimit.remainingFailures15m < LIMIT_15M_FAILURES;
  const is15mExhausted = rateLimit !== null && rateLimit.remainingFailures15m === 0;

  return (
    <Block padding={{ base: "sm", sm: "md" }} className="rounded-lg border border-border bg-card">
      <Stack gap="sm">
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
          <Stack gap="sm">
            {/* 検証完了（承認候補）後は判定ボタンを非表示。不承認 / 未判定時のみ表示。 */}
            {buttonShouldShow && (
              <Flex justify="center">
                <Button
                  type="button"
                  variant={result === null ? "default" : "outline"}
                  size="lg"
                  className="w-full max-w-xs"
                  onClick={handleJudge}
                  disabled={isRateLimited}
                  loading={loading}
                  loadingLabel="判定中..."
                >
                  {renderButtonContent({ result, isRateLimited })}
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
  result,
  isRateLimited,
}: {
  result: JudgmentResult | null;
  isRateLimited: boolean;
}) {
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
  const isPassed = result.passed;
  return (
    <Stack gap="sm" className="rounded-md border border-border bg-background p-3">
      <Flex justify="center">
        <SoftBadge variant={isPassed ? "success" : "destructive"} size="md">
          {isPassed ? "検証完了" : "不承認"}
        </SoftBadge>
      </Flex>

      {/* ストリクトモード時は 3 点チェックリストのみ表示（確信度バーは出さない）。
          通過判定は 3 点の合否で決まるため、確信度はユーザーに提示しない方が分かりやすい。 */}
      {result.strictChecks ? (
        <StrictCheckList checks={result.strictChecks} />
      ) : (
        <ResultBar isPassed={isPassed} confidence={result.confidence} />
      )}

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
    <Stack gap="2xs">
      {items.map(({ label, confirmed }) => (
        <Flex key={label} gap="xs" align="center">
          {confirmed ? (
            <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success-text" />
          ) : (
            <CircleX aria-hidden className="h-4 w-4 shrink-0 text-destructive-text" />
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
      <Block>
        <Flex justify="between">
          <Span tone="muted" size="sm">
            確信度
          </Span>
          <Span weight="medium" size="sm">
            {confidence} / 100
          </Span>
        </Flex>
        <Block className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
          <Block
            className={`h-full transition-all ${tone}`}
            style={{ width: `${confidence}%` }}
          />
        </Block>
      </Block>
    );
  }
  const tone =
    confidence >= 70
      ? "bg-destructive"
      : confidence >= 40
        ? "bg-destructive/70"
        : "bg-destructive/40";
  return (
    <Block>
      <Flex justify="between">
        <Span tone="destructive" size="sm">
          不正確信度
        </Span>
        <Span weight="medium" size="sm" tone="destructive">
          {confidence} / 100
        </Span>
      </Flex>
      <Block className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
        <Block
          className={`h-full transition-all ${tone}`}
          style={{ width: `${confidence}%` }}
        />
      </Block>
    </Block>
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
