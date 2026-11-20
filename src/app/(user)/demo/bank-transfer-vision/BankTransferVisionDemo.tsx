"use client";

import { useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Form/Button/Button";
import { Input, NumberInput, SwitchInput } from "@/components/Form/Input/Manual";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { MediaInput } from "@/lib/mediaInputSuite";
import { useBankTransferVisionDemo } from "@/features/core/demo/hooks/useBankTransferVisionDemo";
import type { DemoJudgmentResult, DemoStrictChecks } from "@/features/core/demo/types/bankTransferVision";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const BankTransferVisionDemo = () => {
  const [file, setFile] = useState<File | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const { judge, clear, clearResult, result, loading, error } = useBankTransferVisionDemo();
  // ストリクトモード（振込人名・識別数字・金額の 3 点確認）の切り替えと期待値
  const [strictMode, setStrictMode] = useState(false);
  const [expectedIdentifier, setExpectedIdentifier] = useState("");
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);

  // ストリクト時は期待値が両方揃わないと判定不可
  const strictReady =
    expectedIdentifier.trim() !== "" && expectedAmount !== null && expectedAmount > 0;
  const canJudge = !!file && !loading && (!strictMode || strictReady);

  const handleJudge = async () => {
    if (!file || !canJudge) return;
    await judge({
      file,
      strict: strictMode
        ? { expectedIdentifier: expectedIdentifier.trim(), expectedAmount: expectedAmount ?? 0 }
        : undefined,
    });
  };

  const handleReset = () => {
    setFile(null);
    clear();
    setResetSignal((n) => n + 1);
  };

  return (
    <Stack gap="lg">
      <MediaInput
        accept={ACCEPTED_MIME_TYPES.join(",")}
        validationRule={{
          allowedMimeTypes: ACCEPTED_MIME_TYPES,
          maxSizeBytes: 5 * 1024 * 1024,
        }}
        helperText="jpeg / png / gif / webp、最大5MB"
        onFileChange={(next) => {
          setFile(next);
          clear();
        }}
        resetSignal={resetSignal}
      />

      <Stack gap="sm">
        <SwitchInput
          value={strictMode}
          label="ストリクトモード"
          description="振込人名・名前の前後の識別数字・振込金額の3点が明細内で確認できなければ不合格にします"
          onChange={(next) => {
            setStrictMode(next);
            // モード切替後の結果は前提が異なるためクリアする
            clear();
          }}
        />

        {strictMode && (
          <Block padding={{ base: "sm", sm: "md" }} className="rounded-lg border border-border bg-card">
            <Stack gap="sm">
              <Stack gap="2xs">
                <Span size="sm" weight="medium">
                  識別数字（振込人名の前後に付与されている想定の数字）
                </Span>
                <Input
                  value={expectedIdentifier}
                  placeholder="例: 13495532"
                  inputMode="numeric"
                  onChange={(e) => {
                    setExpectedIdentifier(e.target.value);
                    clearResult();
                  }}
                />
              </Stack>
              <Stack gap="2xs">
                <Span size="sm" weight="medium">
                  振込金額（円）
                </Span>
                <NumberInput
                  nullable
                  value={expectedAmount}
                  min={1}
                  placeholder="例: 10000"
                  onChange={(next) => {
                    setExpectedAmount(next);
                    clearResult();
                  }}
                />
              </Stack>
              {!strictReady && (
                <Para size="xs" tone="muted">
                  識別数字と振込金額の両方を入力すると判定できます。
                </Para>
              )}
            </Stack>
          </Block>
        )}
      </Stack>

      <Flex gap="xs">
        <Button onClick={handleJudge} disabled={!canJudge}>
          {loading ? "判定中..." : "判定する"}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={loading}>
          リセット
        </Button>
      </Flex>

      {error ? (
        <Para tone="destructive" size="sm">
          エラー: {error}
        </Para>
      ) : null}

      {result ? <ResultView result={result} /> : null}
    </Stack>
  );
};

const ResultView = ({ result }: { result: DemoJudgmentResult }) => {
  return (
    <Stack gap="md" className="rounded-lg border bg-card p-4">
      <Flex align="center" gap="sm">
        <SoftBadge variant={result.isLikelyBankTransfer ? "success" : "destructive"}>
          {result.isLikelyBankTransfer ? "通過候補" : "却下候補"}
        </SoftBadge>
        <SoftBadge variant="muted">{imageTypeLabel(result.imageType)}</SoftBadge>
      </Flex>

      {/* ストリクトモード時は本番 UI と同様に 3 点チェックリストのみ表示
          （確信度は生レスポンス JSON で確認可能） */}
      {result.strictChecks ? (
        <StrictCheckList checks={result.strictChecks} />
      ) : (
        <ConfidenceBar value={result.confidence} />
      )}

      <Block>
        <Para size="sm" weight="medium">
          判定根拠
        </Para>
        <Para tone="muted" size="sm">
          {result.reason}
        </Para>
      </Block>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">生レスポンス JSON</summary>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </Stack>
  );
};

/**
 * ストリクトモードの必須 3 点チェック結果の一覧表示。
 * 読み取れた振込人名も補足表示してプロンプト調整の手がかりにする。
 */
const StrictCheckList = ({ checks }: { checks: DemoStrictChecks }) => {
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
      {checks.detectedSenderName ? (
        <Para size="xs" tone="muted">
          読み取れた振込人名: {checks.detectedSenderName}
        </Para>
      ) : null}
    </Stack>
  );
};

const ConfidenceBar = ({ value }: { value: number }) => {
  const tone = value >= 70 ? "bg-success" : value >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <Block>
      <Flex justify="between" className="text-sm">
        <Span tone="muted">確信度</Span>
        <Span weight="medium">{value} / 100</Span>
      </Flex>
      <Block className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
        <Block
          className={`h-full transition-all ${tone}`}
          style={{ width: `${value}%` }}
        />
      </Block>
    </Block>
  );
};

const imageTypeLabel = (type: DemoJudgmentResult["imageType"]): string => {
  switch (type) {
    case "photo":
      return "写真";
    case "screenshot":
      return "スクリーンショット";
    default:
      return "その他";
  }
};
