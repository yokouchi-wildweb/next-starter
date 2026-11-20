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
import { Input } from "@/components/Form/Input/Manual";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";
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

  // 外からの取り消しの合図(resetSignal)で選んだファイルを外す。描画の中で前の合図と比べる(effect で外すと 1 描画ずれる)
  const [seenResetSignal, setSeenResetSignal] = useState(resetSignal);
  if (seenResetSignal !== resetSignal) {
    setSeenResetSignal(resetSignal);
    setSelectedFile(null);
    setPreparing(false);
  }

  // 合図で整えている途中の処理を捨て(届いた結果を無視する番号を進める)、DOM の file 入力を空にする
  useEffect(() => {
    prepareSeqRef.current += 1;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [resetSignal]);

  // 整えている間の表示（呼び出し側の containerOverlay があればそちらを出す）
  const overlay =
    containerOverlay ??
    (preparing ? (
      <Para role="status" size="sm" weight="inherit" tone="muted" align="inherit" className="my-0">
        画像を準備中…
      </Para>
    ) : null);
  const hasContainerOverlay = Boolean(overlay);

  return (
    <Block className="relative isolate">
      {hasContainerOverlay ? (
        <Flex align="center" justify="center" className="absolute inset-0 z-40 rounded border-2 border-dashed border-border bg-background/80">
          {overlay}
        </Flex>
      ) : null}
      <Stack gap="xs" className={cn(hasContainerOverlay && "pointer-events-none opacity-70")} aria-busy={hasContainerOverlay}>
        <Flex
          direction="column"
          align="center"
          justify="center"
          gap="xs"
          role="button"
          tabIndex={0}
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative min-h-24 w-full cursor-pointer rounded border-2 border-dashed px-3 py-3 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/70 hover:bg-muted/40",
            isDragging ? "border-primary bg-primary/5" : "border-border bg-background",
            hasContainerOverlay && "z-10",
          )}
          {...eventHandlers}
        >
          {selectedFile || previewUrl ? (
            <Flex direction="column" align="center" gap="xs" className="w-full">
              <Flex align="center" justify="center" className="relative h-40 w-full max-w-[320px] overflow-hidden rounded p-2">
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
                  <Span srOnly>{clearButtonLabel}</Span>
                </Button>
              </Flex>
              <Span size="inherit" weight="medium" tone="default" align="center" className="break-all">
                {selectedFile ? `選択中: ${selectedFile.name}` : previewUrl ? "アップロード済み" : ""}
              </Span>
            </Flex>
          ) : (
            <Flex direction="column" align="center" gap="2xs">
              <Span size="inherit" weight="medium" tone="muted" align="center">{dropLabel}</Span>
              {helperText ? (
                <Para size="xs" weight="inherit" tone="muted" align="center" className="my-0">{helperText}</Para>
              ) : null}
            </Flex>
          )}
        </Flex>
        {validationError ? (
          <Para size="xs" weight="inherit" tone="destructive" align="inherit" className="my-0">{formatValidationError(validationError)}</Para>
        ) : null}
        <Input
          ref={inputRef}
          id={inputId}
          type="file"
          hidden
          disabled={disabled}
          accept={accept}
          onChange={handleFileChange}
        />
      </Stack>
    </Block>
  );
};
