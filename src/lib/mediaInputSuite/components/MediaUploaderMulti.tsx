"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { GripVerticalIcon, ImagePlusIcon, XIcon } from "lucide-react";
import { uuidv7 } from "uuidv7";

import { Button } from "@/components/Form/Button/Button";
import { Para } from "@/components/TextBlocks";
import { PseudoButton } from "@/components/Form/Button/PseudoButton";
import { cn } from "@/lib/cn";
import { clientUploader, type UploadProgress } from "@/lib/storage/client/clientUploader";

import { MediaPreview } from "./MediaPreview";
import { MediaThumbGrid } from "./MediaThumbGrid";
import type { FileValidationError, FileValidationRule } from "../types";
import { validateFile } from "../utils";

const isStorageCanceledError = (error: unknown): error is { code?: string } => {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code === "storage/canceled";
};

/**
 * 複数枚アップローダ用の追加バリデーション
 * minItems / maxItems は zod スキーマと UI 側の二重防衛
 */
export type MediaUploaderMultiValidationRule = FileValidationRule & {
  /** 最小件数 */
  minItems?: number;
  /** 最大件数（既定 10） */
  maxItems?: number;
};

export type MediaUploaderMultiProps = {
  uploadPath: string;
  initialUrls?: string[] | null;
  onUrlsChange?: (urls: string[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  /** アップロード完了直後の URL を pending upload に登録するためのフック */
  onRegisterPendingUpload?: (url: string | null) => void;
  /** 削除確定時の URL を pending delete に登録するためのフック */
  onRegisterPendingDelete?: (url: string | null) => void;
  validationRule?: MediaUploaderMultiValidationRule;
  onValidationError?: (error: FileValidationError) => void;
  accept?: string;
  helperText?: string;
  /** 並び替え可否（既定 true） */
  reorderable?: boolean;
  /** 全体無効化 */
  disabled?: boolean;
  /** 追加スロットのラベル */
  dropLabel?: string;
  /** 削除ボタンのラベル */
  clearButtonLabel?: string;
};

/** 既定の最大件数 */
const DEFAULT_MAX_ITEMS = 10;

/** 各スロットの内部ステート */
type SlotState =
  | { kind: "uploaded"; id: string; url: string }
  | { kind: "uploading"; id: string; file: File; progress: UploadProgress | null; cancel: () => void; objectUrl: string }
  | { kind: "error"; id: string; file: File; message: string; objectUrl: string };

const slotIsUploading = (slot: SlotState): slot is Extract<SlotState, { kind: "uploading" }> =>
  slot.kind === "uploading";

export const MediaUploaderMulti = ({
  uploadPath,
  initialUrls,
  onUrlsChange,
  onUploadingChange,
  onRegisterPendingUpload,
  onRegisterPendingDelete,
  validationRule,
  onValidationError,
  accept,
  helperText,
  reorderable = true,
  disabled = false,
  dropLabel = "クリックまたはドラッグ＆ドロップで追加",
  clearButtonLabel = "削除",
}: MediaUploaderMultiProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [slots, setSlots] = useState<SlotState[]>(() =>
    (initialUrls ?? []).map((url) => ({ kind: "uploaded", id: uuidv7(), url })),
  );
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const maxItems = validationRule?.maxItems ?? DEFAULT_MAX_ITEMS;

  // initialUrls の変更で外側からの再同期に追随する（フォーム再初期化等）
  // 同内容なら何もしない（onUrlsChange → field 更新 → initialUrls 再供給のループで ID が振り直される事故を防ぐ）
  useEffect(() => {
    if (!initialUrls) return;
    setSlots((prev) => {
      const prevUploaded = prev
        .filter((s): s is Extract<SlotState, { kind: "uploaded" }> => s.kind === "uploaded")
        .map((s) => s.url);
      const sameContent =
        prevUploaded.length === initialUrls.length &&
        prevUploaded.every((u, i) => u === initialUrls[i]);
      if (sameContent) return prev;
      const uploadingOrError = prev.filter((s) => s.kind !== "uploaded");
      const uploaded: SlotState[] = initialUrls.map((url) => ({ kind: "uploaded", id: uuidv7(), url }));
      return [...uploaded, ...uploadingOrError];
    });
  }, [initialUrls]);

  const uploadedUrls = useMemo(
    () => slots.filter((s): s is Extract<SlotState, { kind: "uploaded" }> => s.kind === "uploaded").map((s) => s.url),
    [slots],
  );

  // 確定済 URL 配列が変わったら通知
  const lastNotifiedRef = useRef<string>("");
  useEffect(() => {
    const key = uploadedUrls.join("");
    if (key === lastNotifiedRef.current) return;
    lastNotifiedRef.current = key;
    onUrlsChange?.(uploadedUrls);
  }, [uploadedUrls, onUrlsChange]);

  // アップロード中の有無を通知
  const isUploading = useMemo(() => slots.some(slotIsUploading), [slots]);
  const lastUploadingRef = useRef<boolean>(false);
  useEffect(() => {
    if (lastUploadingRef.current === isUploading) return;
    lastUploadingRef.current = isUploading;
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  // unmount 時、生成中の objectURL を解放
  useEffect(() => {
    return () => {
      setSlots((prev) => {
        prev.forEach((s) => {
          if (s.kind !== "uploaded") {
            try {
              URL.revokeObjectURL(s.objectUrl);
            } catch {
              // noop
            }
          }
        });
        return prev;
      });
    };
  }, []);

  const beginUpload = useCallback(
    (file: File, slotId: string) => {
      const handle = clientUploader.upload(file, {
        basePath: uploadPath,
        onProgress: (p) => {
          setSlots((prev) =>
            prev.map((s) =>
              s.id === slotId && s.kind === "uploading" ? { ...s, progress: p } : s,
            ),
          );
        },
        onComplete: ({ url }) => {
          setSlots((prev) => {
            const target = prev.find((s) => s.id === slotId);
            if (target && target.kind !== "uploaded") {
              try {
                URL.revokeObjectURL(target.objectUrl);
              } catch {
                // noop
              }
            }
            return prev.map((s) =>
              s.id === slotId ? { kind: "uploaded", id: slotId, url } : s,
            );
          });
          onRegisterPendingUpload?.(url);
        },
        onError: (err) => {
          setSlots((prev) =>
            prev.map((s) => {
              if (s.id !== slotId) return s;
              if (s.kind !== "uploading") return s;
              const message = isStorageCanceledError(err)
                ? "アップロードをキャンセルしました。"
                : err.message;
              return { kind: "error", id: slotId, file: s.file, message, objectUrl: s.objectUrl };
            }),
          );
        },
      });

      setSlots((prev) =>
        prev.map((s) => (s.id === slotId && s.kind === "uploading" ? { ...s, cancel: () => handle.cancel() } : s)),
      );
    },
    [uploadPath, onRegisterPendingUpload],
  );

  const enqueueFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      // 件数上限チェック（既存スロット + 新規分）
      const remaining = Math.max(0, maxItems - slots.length);
      const accepted = files.slice(0, remaining);
      const rejectedByCount = files.slice(remaining);

      if (rejectedByCount.length > 0) {
        onValidationError?.({
          type: "size",
          message: `登録可能な件数の上限（${maxItems}件）を超えました。`,
          maxSizeBytes: 0,
        });
      }

      // バリデーションを通過したファイルだけスロット追加
      const validSlots: Array<Extract<SlotState, { kind: "uploading" }>> = [];
      for (const file of accepted) {
        if (validationRule) {
          const error = validateFile(file, validationRule);
          if (error) {
            onValidationError?.(error);
            continue;
          }
        }
        const id = uuidv7();
        const objectUrl = URL.createObjectURL(file);
        validSlots.push({
          kind: "uploading",
          id,
          file,
          progress: null,
          cancel: () => undefined,
          objectUrl,
        });
      }

      if (validSlots.length === 0) return;
      setSlots((prev) => [...prev, ...validSlots]);
      validSlots.forEach((s) => beginUpload(s.file, s.id));
    },
    [beginUpload, maxItems, onValidationError, slots.length, validationRule],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      enqueueFiles(files);
      // 同じファイルを再選択できるように input をリセット
      event.target.value = "";
    },
    [enqueueFiles],
  );

  const handleRemove = useCallback(
    (slotId: string) => {
      setSlots((prev) => {
        const target = prev.find((s) => s.id === slotId);
        if (!target) return prev;
        if (target.kind === "uploading") {
          try {
            target.cancel();
          } catch {
            // noop
          }
          try {
            URL.revokeObjectURL(target.objectUrl);
          } catch {
            // noop
          }
        } else if (target.kind === "error") {
          try {
            URL.revokeObjectURL(target.objectUrl);
          } catch {
            // noop
          }
        } else if (target.kind === "uploaded") {
          onRegisterPendingDelete?.(target.url);
        }
        return prev.filter((s) => s.id !== slotId);
      });
    },
    [onRegisterPendingDelete],
  );

  const handleReorder = useCallback((newIds: string[]) => {
    setSlots((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      const reordered: SlotState[] = [];
      for (const id of newIds) {
        const slot = map.get(id);
        if (slot) reordered.push(slot);
      }
      // map に残っている（newIds に含まれなかった）スロットがあれば末尾へ
      for (const slot of prev) {
        if (!newIds.includes(slot.id)) reordered.push(slot);
      }
      return reordered;
    });
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      setIsDraggingFile(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) return;
      enqueueFiles(files);
    },
    [disabled, enqueueFiles],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDraggingFile(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
      setIsDraggingFile(false);
    },
    [disabled],
  );

  const handleAddKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  const reachedMax = slots.length >= maxItems;

  const trailingSlot =
    !reachedMax && !disabled ? (
      <div
        role="button"
        tabIndex={0}
        aria-label={dropLabel}
        onKeyDown={handleAddKeyDown}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed p-2 text-xs transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDraggingFile ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/70 hover:bg-muted/40",
        )}
      >
        <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
        <span className="text-center text-muted-foreground">{dropLabel}</span>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-2">
      <MediaThumbGrid
        items={slots}
        reorderable={reorderable}
        disabled={disabled}
        onReorder={handleReorder}
        trailing={trailingSlot}
        renderItem={(slot, { dragHandleListeners, isDragging }) => (
          <ThumbCell
            slot={slot}
            disabled={disabled}
            reorderable={reorderable}
            dragHandleListeners={dragHandleListeners}
            isDragging={isDragging}
            clearButtonLabel={clearButtonLabel}
            onRemove={handleRemove}
          />
        )}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {slots.length} / {maxItems}
        </span>
        {helperText ? <span className="text-right">{helperText}</span> : null}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={handleInputChange}
      />
    </div>
  );
};

type ThumbCellProps = {
  slot: SlotState;
  disabled: boolean;
  reorderable: boolean;
  dragHandleListeners?: import("@dnd-kit/core/dist/hooks/utilities").SyntheticListenerMap;
  isDragging: boolean;
  clearButtonLabel: string;
  onRemove: (slotId: string) => void;
};

const ThumbCell = ({
  slot,
  disabled,
  reorderable,
  dragHandleListeners,
  isDragging,
  clearButtonLabel,
  onRemove,
}: ThumbCellProps) => {
  const previewSrc =
    slot.kind === "uploaded" ? slot.url : slot.kind === "uploading" ? slot.objectUrl : slot.objectUrl;
  const previewFile = slot.kind === "uploaded" ? null : slot.file;

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden rounded border bg-muted",
        isDragging && "ring-2 ring-primary",
      )}
    >
      <MediaPreview
        file={previewFile}
        src={previewSrc}
        className="h-full w-full"
        imageProps={{ fit: "cover" }}
        videoProps={{ fit: "cover", controls: false }}
      />
      {/* アップロード進捗オーバーレイ */}
      {slot.kind === "uploading" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 px-2 text-center">
          <Para tone="muted" size="xs">
            {slot.progress?.percent ?? 0}%
          </Para>
          <div className="h-1 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${slot.progress?.percent ?? 0}%`, transition: "width 120ms linear" }}
            />
          </div>
          <PseudoButton
            type="button"
            variant="ghost"
            size="sm"
            className="text-[10px] text-muted-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove(slot.id);
            }}
          >
            キャンセル
          </PseudoButton>
        </div>
      ) : null}
      {/* エラー表示 */}
      {slot.kind === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/80 px-2 text-center text-[10px] text-destructive-foreground">
          <span className="line-clamp-3">{slot.message}</span>
        </div>
      ) : null}
      {/* 並び替えハンドル */}
      {reorderable && !disabled && slot.kind !== "uploading" ? (
        <button
          type="button"
          aria-label="並び替え"
          {...dragHandleListeners}
          className="absolute left-1 top-1 z-10 flex size-6 cursor-grab items-center justify-center rounded bg-background/80 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          onClick={(event) => {
            // ドラッグ開始のみで onClick は抑制
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <GripVerticalIcon className="size-4" aria-hidden />
        </button>
      ) : null}
      {/* 削除ボタン */}
      {!disabled ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-1 top-1 z-10 size-6"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(slot.id);
          }}
        >
          <XIcon className="size-3" />
          <span className="sr-only">{clearButtonLabel}</span>
        </Button>
      ) : null}
    </div>
  );
};

