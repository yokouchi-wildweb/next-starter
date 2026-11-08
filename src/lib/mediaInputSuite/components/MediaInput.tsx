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
  containerOverlay?: ReactNode;
  resetSignal?: number;
  clearButtonDisabled?: boolean;
  /**
   * 選んだファイルを、サイズの検査（validationRule）の前に整える（例: MediaUploader が用途の宣言で画像を縮める）。
   * 整えている間は欄に「画像を準備中…」を出す。投げたら元のファイルのまま検査へ進む（失敗に数えない）。
   * 整えている間に選び直したら後の選択だけを採る。省略 = 整えない（今までどおり）
   */
  prepareFile?: (file: File) => Promise<File>;
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
  containerOverlay,
  resetSignal = 0,
  clearButtonDisabled = false,
  prepareFile,
}: MediaInputProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const [preparing, setPreparing] = useState(false);
  // 整える処理の番号。選び直し・クリア・リセットの後に終わった古い処理の結果は使わない
  const prepareSeqRef = useRef(0);
  const inputId = useId();

  const { metadata: imageMetadata, handleImageLoad } = useImageMetadata({
    source: { file: selectedFile, src: !selectedFile ? previewUrl ?? null : null },
  });
  const { metadata: videoMetadata, handleVideoMetadata } = useVideoMetadata({
    source: { file: selectedFile, src: !selectedFile ? previewUrl ?? null : null },
  });

  useEffect(() => {
    if (!selectedFile) return;
    onMetadataChange?.({ image: imageMetadata, video: videoMetadata });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageMetadata, videoMetadata, selectedFile]);

  const handleSelect = useCallback(
    (file: File | null) => {
      setSelectedFile(file);
      onFileChange?.(file);
    },
    [onFileChange],
  );

  /** 検査を通ったら選択にする（通らなければ onRejected で入力を戻す） */
  const acceptChecked = useCallback(
    (file: File, onRejected?: () => void) => {
      if (validationRule) {
        const error = validateFile(file, validationRule);
        if (error) {
          setValidationError(error);
          onValidationError?.(error);
          onRejected?.();
          return;
        }
      }
      setValidationError(null);
      handleSelect(file);
    },
    [handleSelect, onValidationError, validationRule],
  );

  /** 整えて（prepareFile）から検査する。prepareFile が無ければ今までどおり同期で検査する */
  const acceptFile = useCallback(
    (file: File, onRejected?: () => void) => {
      if (!prepareFile) {
        acceptChecked(file, onRejected);
        return;
      }
      const seq = ++prepareSeqRef.current;
      setPreparing(true);
      void prepareFile(file)
        .catch((error: unknown) => {
          console.warn("[mediaInput] ファイルを整えられなかったため、元のファイルのまま扱います", error);
          return file;
        })
        .then((prepared) => {
          if (seq !== prepareSeqRef.current) return;
          setPreparing(false);
          acceptChecked(prepared, onRejected);
        });
    },
    [acceptChecked, prepareFile],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        return;
      }
      const target = event.target;
      acceptFile(file, () => {
        target.value = "";
      });
    },
    [acceptFile],
  );

  /** 整えている途中の処理を捨てる（クリア・リセット） */
  const abandonPreparing = useCallback(() => {
    prepareSeqRef.current += 1;
    setPreparing(false);
  }, []);

  const handleClear = useCallback(() => {
    abandonPreparing();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    handleSelect(null);
  }, [abandonPreparing, handleSelect]);

  const { isDragging, eventHandlers } = useDragAndDrop({
    disabled,
    onDropFile: (file) => acceptFile(file),
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

  useEffect(() => {
    abandonPreparing();
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [resetSignal, abandonPreparing]);

  // 整えている間の表示（呼び出し側の containerOverlay があればそちらを出す）
  const overlay =
    containerOverlay ??
    (preparing ? (
      <p role="status" className="text-sm text-muted-foreground">
        画像を準備中…
      </p>
    ) : null);
  const hasContainerOverlay = Boolean(overlay);

  return (
    <div className="relative">
      {hasContainerOverlay ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded border-2 border-dashed border-border bg-background/80">
          {overlay}
        </div>
      ) : null}
      <div className={cn("flex flex-col gap-2", hasContainerOverlay && "pointer-events-none opacity-70")} aria-busy={hasContainerOverlay}>
        <div
          role="button"
          tabIndex={0}
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-3 py-3 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/70 hover:bg-muted/40",
            isDragging ? "border-primary bg-primary/5" : "border-border bg-background",
            hasContainerOverlay && "z-10",
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
                  imageProps={{
                    onLoad: selectedFile ? handleImageLoad : undefined,
                    ...previewProps?.imageProps,
                  }}
                  videoProps={{
                    onLoadedMetadata: selectedFile ? handleVideoMetadata : undefined,
                    ...previewProps?.videoProps,
                  }}
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
          <p className="text-xs text-destructive-text">{formatValidationError(validationError)}</p>
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
    </div>
  );
};
