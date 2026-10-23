// src/features/core/purchaseRequest/components/BankTransferInstruction/PrepareProofImage.tsx
//
// ② 振込明細の画像を用意するセクション。
// HTML 標準の <input type="file" accept="image/*"> を経由して、
// iOS / Android のネイティブシート（カメラ起動 or フォトライブラリ）で画像を取得する。
// 取得後は即時に非公開の用途 purchaseRequest.bankProof へアップロードし、ref を親に通知する。
//
// 実装ポリシー:
// - アップロードタイミング: 添付直後（即時）
// - 保存先: useBankTransferProofUpload（scopeId = requestId。差し替え時は前の未申告の画像を取り消す）
// - プレビュー: ローカルの blob URL（即時表示）。アップロード完了後も blob URL を維持
//   （親に渡すのは storage の ref）
// - 削除: ローカル state をリセットし、上げた画像を取り消す（申告済みの画像は取り消されない）

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
import { resolveStorageSrc } from "@/lib/storage";
import { useToast } from "@/lib/toast";

import { useBankTransferProofUpload } from "@/features/core/purchaseRequest/hooks/useBankTransferProofUpload";

import { circledNumber } from "./stepNumber";

type Props = {
  /** 親が動的に決定するステップ番号 (例: 2) */
  step: number;
  /** purchase_request の ID（アップロードパスの一部に使用） */
  requestId: string;
  /** アップロード済み画像の ref（または表示できる URL）。null = 未添付 */
  imageUrl: string | null;
  /**
   * アップロード成功 / クリア時のコールバック。
   * - url: 画像の storage ref（Step④ 申告 API に渡す）
   * - file: 選択された File オブジェクト（Step③ の AI 判定 API へ multipart で渡す）。クリア時は null。
   */
  onChange: (url: string | null, file: File | null) => void;
};

export function PrepareProofImage({ step, requestId, imageUrl, onChange }: Props) {
  const { upload, discardCurrent } = useBankTransferProofUpload(requestId);
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

    // 差し替え瞬間に親側の URL/File/判定結果を即時無効化する。
    // これをしないとアップロード完了までは旧 URL と旧判定結果が残り、
    // Step④ ボタンが古い判定で押せてしまう。
    onChange(null, null);

    // ローカルプレビューを即時表示
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localUrl;
    });
    setIsUploading(true);

    try {
      const { ref } = await upload(file);
      onChange(ref, file);
    } catch {
      showToast("画像のアップロードに失敗しました", "error");
      URL.revokeObjectURL(localUrl);
      setPreviewUrl(null);
      onChange(null, null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    discardCurrent();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onChange(null, null);
  };

  const hasAttached = imageUrl !== null || previewUrl !== null;
  // blob プレビューが無いとき（親が値だけ持っているとき）は ref を表示用 URL に解決する
  const displayUrl = previewUrl ?? resolveStorageSrc(imageUrl) ?? "";

  return (
    <Block padding="md" className="rounded-lg border border-border bg-card">
      <Stack space={3}>
        <Span weight="semiBold" size="md">
          {circledNumber(step)} 振込明細の画像を用意
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
                <Block className="absolute inset-0 flex items-center justify-center rounded-md bg-overlay/40">
                  <Spinner className="h-8 w-8 text-overlay-foreground" />
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
