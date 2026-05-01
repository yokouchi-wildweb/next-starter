// src/features/core/purchaseRequest/components/BankTransferInstructionPage/PrepareProofImage.tsx
//
// ② 振込明細の画像を用意するセクション。
// HTML 標準の <input type="file" accept="image/*"> を経由して、
// iOS / Android のネイティブシート（カメラ起動 or フォトライブラリ）で画像を取得する。
// 取得後は即時に Firebase Storage へ上書きアップロードし、URL を親に通知する。
//
// 実装ポリシー:
// - アップロードタイミング: 添付直後（即時）
// - パス: useBankTransferProofUpload が固定パスを生成（同 requestId は常に上書き）
// - プレビュー: ローカルの blob URL（即時表示）。アップロード完了後も blob URL を維持
//   （親に渡す URL は Firebase Storage の URL）
// - 削除: ローカル state のみリセット。Storage 側のファイルは消さない（次の上書き / cron でクリーンアップ）

"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, RefreshCw, Trash } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { Para, Span } from "@/components/TextBlocks";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { useToast } from "@/lib/toast";

import { useBankTransferProofUpload } from "@/features/core/purchaseRequest/hooks/useBankTransferProofUpload";

type Props = {
  /** purchase_request の ID（アップロードパスの一部に使用） */
  requestId: string;
  /** アップロード済み画像 URL。null = 未添付 */
  imageUrl: string | null;
  /** アップロード成功 / クリア時のコールバック */
  onChange: (url: string | null) => void;
};

export function PrepareProofImage({ requestId, imageUrl, onChange }: Props) {
  const { upload } = useBankTransferProofUpload(requestId);
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 旧 blob URL のメモリリーク防止（差し替え時 / アンマウント時に解放）
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const triggerFilePicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを再選択しても onChange が発火するように value をリセット
    e.target.value = "";
    if (!file) return;

    // ローカルプレビューを即時表示
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localUrl;
    });
    setIsUploading(true);

    try {
      const url = await upload(file);
      onChange(url);
    } catch {
      showToast("画像のアップロードに失敗しました", "error");
      URL.revokeObjectURL(localUrl);
      setPreviewUrl(null);
      onChange(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onChange(null);
  };

  const hasAttached = imageUrl !== null || previewUrl !== null;
  const displayUrl = previewUrl ?? imageUrl ?? "";

  return (
    <Block padding="md" className="rounded-lg border border-border bg-card">
      <Stack space={3}>
        <Span weight="semiBold" size="md">
          ② 振込明細の画像を用意
        </Span>

        {/* 隠しファイル input。ボタンクリックで OS のネイティブシート（カメラ / ライブラリ）が開く */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {!hasAttached ? (
          <Stack space={2}>
            <Para size="sm" tone="muted">
              ATM の場合は振込明細を撮影、ネットバンキングの場合は完了画面のスクリーンショットを保存してください。
            </Para>
            <Flex justify="center">
              <Button
                type="button"
                variant="default"
                size="lg"
                className="w-full max-w-xs"
                onClick={triggerFilePicker}
              >
                <Camera className="h-4 w-4" />
                画像を添付する
              </Button>
            </Flex>
          </Stack>
        ) : (
          <Stack space={2}>
            <Block className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl}
                alt="振込明細プレビュー"
                className="w-full max-h-80 rounded-md bg-muted object-contain"
              />
              {isUploading && (
                <Block className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
                  <Spinner className="h-8 w-8 text-white" />
                </Block>
              )}
            </Block>
            <Flex justify="center" gap="sm" wrap="wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={triggerFilePicker}
                disabled={isUploading}
              >
                <RefreshCw className="h-4 w-4" />
                差し替え
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={isUploading}
              >
                <Trash className="h-4 w-4" />
                削除
              </Button>
            </Flex>
            {!isUploading && imageUrl && (
              <Span size="xs" tone="success" align="center">
                ✓ アップロード完了
              </Span>
            )}
          </Stack>
        )}
      </Stack>
    </Block>
  );
}
