"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MediaInput, type MediaInputProps } from "./MediaInput";
import type { FileValidationError, FileValidationRule, SelectedMediaMetadata } from "../types";
import { clientUploader, type UploadProgress } from "@/lib/storage/client/clientUploader";
import { directStorageClient, getPathFromStorageUrl } from "@/lib/storage/client/directStorageClient";
import { Para } from "@/components/TextBlocks";
import { PseudoButton } from "@/components/Form/Button/PseudoButton";

const isStorageCanceledError = (error: unknown): error is { code?: string } => {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code === "storage/canceled";
};

export type MediaUploaderProps = Omit<MediaInputProps, "onFileChange" | "previewUrl" | "statusOverlay" | "clearButtonDisabled"> & {
  uploadPath: string;
  initialUrl?: string | null;
  onUrlChange?: (url: string | null) => void;
  validationRule?: FileValidationRule;
  onValidationError?: (error: FileValidationError) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  onRegisterPendingUpload?: (url: string | null) => void;
  onRegisterPendingDelete?: (url: string | null) => void;
};

export const MediaUploader = ({
  uploadPath,
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
  const uploadedPathRef = useRef<string | null>(initialUrl ? getPathFromStorageUrl(initialUrl) ?? null : null);

  useEffect(() => {
    setCurrentUrl(initialUrl);
    uploadedPathRef.current = initialUrl ? getPathFromStorageUrl(initialUrl) ?? null : null;
  }, [initialUrl]);

  const updateUrl = useCallback(
    (url: string | null) => {
      setCurrentUrl(url);
      onUrlChange?.(url);
    },
    [onUrlChange],
  );

  const removeUploadedFile = useCallback(async () => {
    uploadedPathRef.current = null;
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
      uploadHandleRef.current = clientUploader.upload(file, {
        basePath: uploadPath,
        onProgress: (p) => setProgress(p),
        onComplete: ({ url, path }) => {
          uploadHandleRef.current = null;
          uploadedPathRef.current = path;
          setProgress(null);
          onUploadingChange?.(false);
          onRegisterPendingUpload?.(url);
          updateUrl(url);
        },
        onError: (err) => {
          uploadHandleRef.current = null;
          setProgress(null);
          if (isStorageCanceledError(err)) {
            setError("アップロードをキャンセルしました。");
          } else {
            setError(err.message);
          }
          onUploadingChange?.(false);
        },
      });
    },
    [removeUploadedFile, updateUrl, uploadPath, onUploadingChange, onRegisterPendingUpload],
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
        const previousUrl = uploadedPathRef.current ? currentUrl : initialUrl;
        if (previousUrl) {
          onRegisterPendingDelete?.(previousUrl);
        }
        cancelUpload({ notify: Boolean(progress) });
        return;
      }
      beginUpload(file);
    },
    [beginUpload, cancelUpload, progress, currentUrl, initialUrl, onRegisterPendingDelete],
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
};
