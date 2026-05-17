"use client";

import axios, { AxiosError } from "axios";
import { useState } from "react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button/Button";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";
import { MediaInput } from "@/lib/mediaInputSuite";

type JudgmentResult = {
  isLikelyBankTransfer: boolean;
  confidence: number;
  imageType: "photo" | "screenshot" | "other";
  reason: string;
};

type ApiError = { message?: string };

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const BankTransferVisionDemo = () => {
  const [file, setFile] = useState<File | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JudgmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleJudge = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post<JudgmentResult>(
        "/api/demo/bank-transfer-vision",
        formData,
      );
      setResult(res.data);
    } catch (e) {
      if (e instanceof AxiosError) {
        const data = e.response?.data as ApiError | undefined;
        setError(data?.message ?? e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("判定に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setResetSignal((n) => n + 1);
  };

  return (
    <Stack space={6}>
      <MediaInput
        accept={ACCEPTED_MIME_TYPES.join(",")}
        validationRule={{
          allowedMimeTypes: ACCEPTED_MIME_TYPES,
          maxSizeBytes: 5 * 1024 * 1024,
        }}
        helperText="jpeg / png / gif / webp、最大5MB"
        onFileChange={(next) => {
          setFile(next);
          setResult(null);
          setError(null);
        }}
        resetSignal={resetSignal}
      />

      <div className="flex gap-2">
        <Button onClick={handleJudge} disabled={!file || loading}>
          {loading ? "判定中..." : "判定する"}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={loading}>
          リセット
        </Button>
      </div>

      {error ? (
        <Para tone="destructive" size="sm">
          エラー: {error}
        </Para>
      ) : null}

      {result ? <ResultView result={result} /> : null}
    </Stack>
  );
};

const ResultView = ({ result }: { result: JudgmentResult }) => {
  return (
    <Stack space={4} className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <SoftBadge variant={result.isLikelyBankTransfer ? "success" : "destructive"}>
          {result.isLikelyBankTransfer ? "通過候補" : "却下候補"}
        </SoftBadge>
        <SoftBadge variant="muted">{imageTypeLabel(result.imageType)}</SoftBadge>
      </div>

      <ConfidenceBar value={result.confidence} />

      <div>
        <Para size="sm" weight="medium">
          判定根拠
        </Para>
        <Para tone="muted" size="sm">
          {result.reason}
        </Para>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">生レスポンス JSON</summary>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </Stack>
  );
};

const ConfidenceBar = ({ value }: { value: number }) => {
  const tone = value >= 70 ? "bg-success" : value >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex justify-between text-sm">
        <Span tone="muted">確信度</Span>
        <Span weight="medium">{value} / 100</Span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
        <div
          className={`h-full transition-all ${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

const imageTypeLabel = (type: JudgmentResult["imageType"]): string => {
  switch (type) {
    case "photo":
      return "写真";
    case "screenshot":
      return "スクリーンショット";
    default:
      return "その他";
  }
};
