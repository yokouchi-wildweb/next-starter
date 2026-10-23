"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MediaInput, type MediaInputProps } from "./MediaInput";
import type { FileValidationError, FileValidationRule } from "../types";
import { isStorageUploadCanceled, uploadToStorage, type UploadProgress } from "@/lib/storage/client";
import { Para } from "@/components/TextBlocks";
import { PseudoButton } from "@/components/Form/Button/PseudoButton";

export type MediaUploaderProps = Omit<MediaInputProps, "onFileChange" | "previewUrl" | "statusOverlay" | "clearButtonDisabled"> & {
  /** ファイルの用途 ID（`<domain>.<field>`。src/registry/storagePurposeRegistry.ts の登録名） */
  purpose: string;
  /** 画像を描き直して EXIF を落とすか（既定 true。jpeg / png / webp が対象。false で送られたまま） */
  reencodeImage?: boolean;
  /** 値（storage ref、または移行前の旧 URL）。プレビュー（MediaPreview）が ref を表示用 URL にする */
  initialUrl?: string | null;
  onUrlChange?: (url: string | null) => void;
  validationRule?: FileValidationRule;
  onValidationError?: (error: FileValidationError) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  onRegisterPendingUpload?: (url: string | null) => void;
  onRegisterPendingDelete?: (url: string | null) => void;
};

export const MediaUploader = ({
  purpose,
  reencodeImage = true,
  initialUrl = null,
  onUrlChange,
  onMetadataChange,
  validationRule,
  onValidationError,
  helperText,
  onUploadingChange,
  onRegisterPendingUpload,
  onRegisterPendingDelete,
  ...inputProps
}: MediaUploaderProps) => {
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputResetSignal, setInputResetSignal] = useState(0);
  const uploadHandleRef = useRef<{ cancel: () => void } | null>(null);
  useEffect(() => {
    setCurrentUrl(initialUrl);
  }, [initialUrl]);

  const updateUrl = useCallback(
    (url: string | null) => {
      setCurrentUrl(url);
      onUrlChange?.(url);
    },
    [onUrlChange],
  );

  // 値を外すだけ。このセッションで上げた未採用分の discard は pending 管理（usePendingMediaUploads）、
  // 採用済みの旧物の削除は業務保存の detach が担う（クライアントから消さない）
  const removeUploadedFile = useCallback(async () => {
    updateUrl(null);
  }, [updateUrl]);

  const beginUpload = useCallback(
    (file: File) => {
      uploadHandleRef.current?.cancel();
      uploadHandleRef.current = null;
      setProgress(null);
      setError(null);
      onUploadingChange?.(true);
      void removeUploadedFile();
      setProgress({ loaded: 0, total: file.size, percent: 0 });
      uploadHandleRef.current = uploadToStorage(file, {
        purpose,
        reencodeImage,
        onProgress: (p) => setProgress(p),
        onComplete: ({ ref }) => {
          uploadHandleRef.current = null;
          setProgress(null);
          onUploadingChange?.(false);
          onRegisterPendingUpload?.(ref);
          updateUrl(ref);
        },
        onError: (err) => {
          uploadHandleRef.current = null;
          setProgress(null);
          if (isStorageUploadCanceled(err)) {
            setError("アップロードをキャンセルしました。");
          } else {
            setError(err.message);
          }
          onUploadingChange?.(false);
        },
      });
    },
    [removeUploadedFile, updateUrl, purpose, reencodeImage, onUploadingChange, onRegisterPendingUpload],
  );

  const cancelUpload = useCallback((options?: { notify?: boolean }) => {
    uploadHandleRef.current?.cancel();
    uploadHandleRef.current = null;
    setProgress(null);
    if (options?.notify ?? true) {
      setError("アップロードをキャンセルしました。");
    } else {
      setError(null);
    }
    setInputResetSignal((value) => value + 1);
    void removeUploadedFile();
    onUploadingChange?.(false);
  }, [removeUploadedFile, onUploadingChange]);

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        onUploadingChange?.(true);
        const previousUrl = currentUrl ?? initialUrl;
        if (previousUrl) {
          onRegisterPendingDelete?.(previousUrl);
        }
        cancelUpload({ notify: Boolean(progress) });
        return;
      }
      beginUpload(file);
    },
    [beginUpload, cancelUpload, progress, currentUrl, initialUrl, onRegisterPendingDelete, onUploadingChange],
  );

  const overlay = useMemo(() => {
    if (!progress) return null;
    return (
      <div className="flex w-full max-w-xs flex-col items-center justify-center gap-2 rounded border border-border bg-background px-4 py-3 text-center shadow-sm">
        <Para tone="muted" size="sm">
          アップロード中... {progress.percent}%
        </Para>
        <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary" style={{ width: `${progress.percent}%`, transition: "width 120ms linear" }} />
        </div>
        <PseudoButton
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={(event) => {
            event.preventDefault();
            cancelUpload();
          }}
        >
          キャンセル
        </PseudoButton>
      </div>
    );
  }, [progress, cancelUpload]);

  return (
    <div className="flex flex-col gap-2">
      <MediaInput
        {...inputProps}
        helperText={helperText}
        validationRule={validationRule}
        onValidationError={onValidationError}
        onMetadataChange={onMetadataChange}
        onFileChange={handleFileChange}
        previewUrl={currentUrl}
        resetSignal={inputResetSignal}
        containerOverlay={overlay}
        clearButtonDisabled={Boolean(progress)}
      />
      {error ? <p className="text-xs text-destructive-text">{error}</p> : null}
    </div>
  );
};
