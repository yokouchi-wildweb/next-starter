"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MediaInput, type MediaInputProps } from "./MediaInput";
import type { FileValidationError, FileValidationRule, SelectedMediaMetadata } from "../types";
import { clientUploader, type UploadProgress } from "@/lib/storage/client/clientUploader";
import { directStorageClient, getPathFromStorageUrl } from "@/lib/storage/client/directStorageClient";
import { Para } from "@/components/TextBlocks";

export type MediaUploaderProps = Omit<MediaInputProps, "onFileChange" | "previewUrl" | "statusOverlay" | "clearButtonDisabled"> & {
  uploadPath: string;
  initialUrl?: string | null;
  onUrlChange?: (url: string | null) => void;
  validationRule?: FileValidationRule;
  onValidationError?: (error: FileValidationError) => void;
};

export const MediaUploader = ({
  uploadPath,
  initialUrl = null,
  onUrlChange,
  onMetadataChange,
  validationRule,
  onValidationError,
  helperText,
  ...inputProps
}: MediaUploaderProps) => {
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    const path = uploadedPathRef.current;
    if (!path) {
      updateUrl(null);
      return;
    }
    try {
      await directStorageClient.remove(path);
    } catch (err) {
      console.error(err);
    } finally {
      uploadedPathRef.current = null;
      updateUrl(null);
    }
  }, [updateUrl]);

  const beginUpload = useCallback(
    (file: File) => {
      uploadHandleRef.current?.cancel();
      uploadHandleRef.current = null;
      setProgress(null);
      setError(null);
      void removeUploadedFile();
      uploadHandleRef.current = clientUploader.upload(file, {
        basePath: uploadPath,
        onProgress: (p) => setProgress(p),
        onComplete: ({ url, path }) => {
          uploadHandleRef.current = null;
          uploadedPathRef.current = path;
          setProgress(null);
          updateUrl(url);
        },
        onError: (err) => {
          uploadHandleRef.current = null;
          setProgress(null);
          setError(err.message);
        },
      });
    },
    [removeUploadedFile, updateUrl, uploadPath],
  );

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        uploadHandleRef.current?.cancel();
        uploadHandleRef.current = null;
        void removeUploadedFile();
        return;
      }
      beginUpload(file);
    },
    [beginUpload, removeUploadedFile],
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
      </div>
    );
  }, [progress]);

  return (
    <div className="space-y-2">
      <MediaInput
        {...inputProps}
        helperText={helperText}
        validationRule={validationRule}
        onValidationError={onValidationError}
        onMetadataChange={onMetadataChange}
        onFileChange={handleFileChange}
        previewUrl={currentUrl}
        containerOverlay={overlay}
        clearButtonDisabled={Boolean(progress)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
};
