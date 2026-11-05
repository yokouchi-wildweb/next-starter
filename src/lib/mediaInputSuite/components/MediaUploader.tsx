"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MediaInput, type MediaInputProps } from "./MediaInput";
import type { FileValidationError, FileValidationRule } from "../types";
import {
  isStorageUploadCanceled,
  pickerAcceptFor,
  uploadToStorage,
  usePurposeMetadata,
  type UploadProgress,
} from "@/lib/storage/client";
import { Para } from "@/components/TextBlocks";
import { PseudoButton } from "@/components/Form/Button/PseudoButton";

export type MediaUploaderProps = Omit<MediaInputProps, "onFileChange" | "previewUrl" | "statusOverlay" | "clearButtonDisabled"> & {
  /** ファイルの用途 ID（`<domain>.<field>`。src/registry/storagePurposeRegistry.ts の登録名） */
  purpose: string;
  /** 送る前にブラウザで画像を描き直すか（既定 false。通信量を減らす任意の前処理。位置情報の除去の保証はサーバー） */
  reencodeImage?: boolean;
  /** 値（storage ref、または移行前の旧 URL）。プレビュー（MediaPreview）が ref を表示用 URL にする */
  initialUrl?: string | null;
  onUrlChange?: (url: string | null) => void;
  validationRule?: FileValidationRule;
  onValidationError?: (error: FileValidationError) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  /**
   * アップロードの失敗の有無が変わったら呼ぶ（失敗 = true。やり直しの開始・成功・取り消しで false）。
   * 利用者が自分で中止したものは失敗に数えない。フォームはこれで送信を止める（AppForm）
   */
  onUploadFailedChange?: (failed: boolean) => void;
  onRegisterPendingUpload?: (url: string | null) => void;
  onRegisterPendingDelete?: (url: string | null) => void;
};

export const MediaUploader = ({
  purpose,
  reencodeImage,
  accept,
  initialUrl = null,
  onUrlChange,
  onMetadataChange,
  validationRule,
  onValidationError,
  helperText,
  onUploadingChange,
  onUploadFailedChange,
  onRegisterPendingUpload,
  onRegisterPendingDelete,
  ...inputProps
}: MediaUploaderProps) => {
  // 用途の方針（サーバーから。分かるまでは accept を狭めない）。strip なら accept の image/* を受け付ける画像の型に狭める
  const metadata = usePurposeMetadata(purpose);
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // アップロードが失敗したまま(中止は含めない)。変わったときだけ onUploadFailedChange へ
  const [failed, setFailed] = useState(false);
  const lastFailedRef = useRef(false);
  useEffect(() => {
    if (lastFailedRef.current === failed) return;
    lastFailedRef.current = failed;
    onUploadFailedChange?.(failed);
  }, [failed, onUploadFailedChange]);
  const [inputResetSignal, setInputResetSignal] = useState(0);
  const uploadHandleRef = useRef<{ cancel: () => void } | null>(null);
  // 現在の値(コールバックから最新値を読むため ref でも持つ)
  const currentUrlRef = useRef<string | null>(initialUrl);
  // アップロード開始前の値。失敗・キャンセルでこの値に戻す(保存済みの値が黙って null で保存されないように)
  const previousUrlRef = useRef<string | null>(null);
  // 進行中のアップロードの番号。中止・やり直しの後に届いた古い onError / onComplete を無視する
  const uploadIdRef = useRef(0);
  useEffect(() => {
    setCurrentUrl(initialUrl);
  }, [initialUrl]);
  useEffect(() => {
    currentUrlRef.current = currentUrl;
  }, [currentUrl]);

  const updateUrl = useCallback(
    (url: string | null) => {
      setCurrentUrl(url);
      currentUrlRef.current = url;
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
      // 選び直し(前のアップロードが進行中)なら、戻し先は最初のアップロード前の値のまま
      if (!uploadHandleRef.current) {
        previousUrlRef.current = currentUrlRef.current;
      }
      uploadHandleRef.current?.cancel();
      uploadHandleRef.current = null;
      const uploadId = ++uploadIdRef.current;
      setProgress(null);
      setError(null);
      setFailed(false);
      onUploadingChange?.(true);
      void removeUploadedFile();
      setProgress({ loaded: 0, total: file.size, percent: 0 });
      uploadHandleRef.current = uploadToStorage(file, {
        purpose,
        reencodeImage,
        onProgress: (p) => {
          if (uploadId !== uploadIdRef.current) return;
          setProgress(p);
        },
        onComplete: ({ ref }) => {
          if (uploadId !== uploadIdRef.current) return;
          uploadHandleRef.current = null;
          previousUrlRef.current = null;
          setProgress(null);
          onUploadingChange?.(false);
          onRegisterPendingUpload?.(ref);
          updateUrl(ref);
        },
        onError: (err) => {
          // 中止(cancelUpload)・選び直しの後に届いた古い通知は無視する
          if (uploadId !== uploadIdRef.current) return;
          uploadHandleRef.current = null;
          setProgress(null);
          if (isStorageUploadCanceled(err)) {
            setError("アップロードをキャンセルしました。");
          } else {
            setError(err.message);
            setFailed(true);
          }
          // 失敗したら選ぶ前の値に戻す。入力の選択中ファイルも外し、プレビューを元の値に戻す
          const previousUrl = previousUrlRef.current;
          previousUrlRef.current = null;
          setInputResetSignal((value) => value + 1);
          updateUrl(previousUrl);
          onUploadingChange?.(false);
        },
      });
    },
    [removeUploadedFile, updateUrl, purpose, reencodeImage, onUploadingChange, onRegisterPendingUpload],
  );

  /**
   * 進行中のアップロードを止める。
   * - restore: true = 選ぶ前の値に戻す(オーバーレイの「キャンセル」)
   * - restore: false = 値を外す(クリア操作)
   */
  const cancelUpload = useCallback((options?: { notify?: boolean; restore?: boolean }) => {
    const wasUploading = Boolean(uploadHandleRef.current);
    // これ以降に届く onError / onComplete を無効にする
    uploadIdRef.current += 1;
    uploadHandleRef.current?.cancel();
    uploadHandleRef.current = null;
    setProgress(null);
    setFailed(false);
    if (options?.notify ?? true) {
      setError("アップロードをキャンセルしました。");
    } else {
      setError(null);
    }
    setInputResetSignal((value) => value + 1);
    const previousUrl = previousUrlRef.current;
    previousUrlRef.current = null;
    if (options?.restore && wasUploading) {
      updateUrl(previousUrl);
    } else {
      void removeUploadedFile();
    }
    onUploadingChange?.(false);
  }, [removeUploadedFile, updateUrl, onUploadingChange]);

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
            cancelUpload({ restore: true });
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
        accept={pickerAcceptFor(accept, metadata ?? "keep")}
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
