"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { MediaPreview, type MediaPreviewProps } from "./MediaPreview";
import { useDragAndDrop, useImageMetadata, useVideoMetadata } from "../hooks";
import type { FileValidationError, FileValidationRule, SelectedMediaMetadata } from "../types";
import { cn } from "@/lib/cn";
import { formatValidationError, validateFile } from "../utils";

export type MediaInputProps = {
  accept?: string;
  disabled?: boolean;
  helperText?: string;
  dropLabel?: string;
  clearButtonLabel?: string;
  previewProps?: Omit<MediaPreviewProps, "file" | "src">;
  validationRule?: FileValidationRule;
  onValidationError?: (error: FileValidationError) => void;
  onFileChange?: (file: File | null) => void;
  onMetadataChange?: (metadata: SelectedMediaMetadata) => void;
  previewUrl?: string | null;
  statusOverlay?: ReactNode;
  clearButtonDisabled?: boolean;
};

export const MediaInput = ({
  accept,
  disabled = false,
  helperText,
  dropLabel = "クリックまたはドラッグ＆ドロップでファイルを選択",
  clearButtonLabel = "削除",
  previewProps,
  validationRule,
  onValidationError,
  onFileChange,
  onMetadataChange,
  previewUrl,
  statusOverlay,
  clearButtonDisabled = false,
}: MediaInputProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const inputId = useId();

  const { metadata: imageMetadata, handleImageLoad } = useImageMetadata({
    source: { file: selectedFile, src: !selectedFile ? previewUrl ?? null : null },
  });
  const { metadata: videoMetadata, handleVideoMetadata } = useVideoMetadata({
    source: { file: selectedFile, src: !selectedFile ? previewUrl ?? null : null },
  });

  useEffect(() => {
    onMetadataChange?.({ image: imageMetadata, video: videoMetadata });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageMetadata, videoMetadata]);

  const handleSelect = useCallback(
    (file: File | null) => {
      setSelectedFile(file);
      onFileChange?.(file);
    },
    [onFileChange],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (file && validationRule) {
        const error = validateFile(file, validationRule);
        if (error) {
          setValidationError(error);
          onValidationError?.(error);
          if (inputRef.current) {
            inputRef.current.value = "";
          }
          return;
        }
      }
      setValidationError(null);
      handleSelect(file);
    },
    [handleSelect, onValidationError, validationRule],
  );

  const handleClear = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    handleSelect(null);
  }, [handleSelect]);

  const { isDragging, eventHandlers } = useDragAndDrop({
    disabled,
    onDropFile: (file) => {
      if (validationRule) {
        const error = validateFile(file, validationRule);
        if (error) {
          setValidationError(error);
          onValidationError?.(error);
          return;
        }
      }
      setValidationError(null);
      handleSelect(file);
    },
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inputRef.current?.click();
      }
    },
    [],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-3 py-3 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/70 hover:bg-muted/40",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-background",
        )}
        {...eventHandlers}
      >
        {selectedFile || previewUrl ? (
          <div className="flex w-full flex-col items-center gap-2">
            <div className="relative flex h-40 w-full max-w-[320px] items-center justify-center overflow-hidden rounded p-2">
              <MediaPreview
                file={selectedFile ?? undefined}
                src={!selectedFile ? previewUrl ?? undefined : undefined}
                className="h-full w-full"
                imageProps={{ onLoad: handleImageLoad, ...previewProps?.imageProps }}
                videoProps={{ onLoadedMetadata: handleVideoMetadata, ...previewProps?.videoProps }}
                unsupportedProps={previewProps?.unsupportedProps}
              />
              {statusOverlay}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 z-10"
                disabled={clearButtonDisabled}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleClear();
                }}
              >
                <XIcon className="size-5" />
                <span className="sr-only">{clearButtonLabel}</span>
              </Button>
            </div>
            <span className="break-all text-center font-medium text-foreground">
              {selectedFile ? `選択中: ${selectedFile.name}` : previewUrl ? "アップロード済み" : ""}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-center font-medium text-muted-foreground">{dropLabel}</span>
            {helperText ? <p className="text-center text-xs text-muted-foreground">{helperText}</p> : null}
          </div>
        )}
      </div>
      {validationError ? (
        <p className="text-xs text-destructive">{formatValidationError(validationError)}</p>
      ) : null}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        disabled={disabled}
        accept={accept}
        onChange={handleFileChange}
      />
    </div>
  );
};
