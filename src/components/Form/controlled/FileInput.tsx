// src/components/Form/FileInput.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/Form/Button";
import { Block } from "@/components/Layout/Block";
import { cn } from "@/lib/cn";
import { XIcon } from "lucide-react";
import { FieldPath, FieldValues } from "react-hook-form";
import type { ControlledInputProps } from "@/types/form";

export type FileInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ControlledInputProps<TFieldValues, TName>, "onSelect"> & {
  /** 初期表示する画像URL */
  initialUrl?: string | null;
  /** 画像選択時に呼ばれるコールバック */
  onSelect?: (file: File | null) => void;
  /**
   * 画像削除前に呼ばれるコールバック。
   * true を返したときのみ削除を実行する
   */
  onRemove?: () => boolean | Promise<boolean>;
  /** ルート要素に適用するクラス名 */
  containerClassName?: string;
  /** 表示用のファイル名。未指定時は field.value から算出 */
  selectedFileName?: string | null;
};

export const FileInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: FileInputProps<TFieldValues, TName>) => {
  const {
    field,
    initialUrl = null,
    onSelect,
    onRemove,
    containerClassName,
    selectedFileName: selectedFileNameProp,
    ...rest
  } = props;
  const {
    className,
    id,
    disabled,
    onChange: onChangeProp,
    value: _valueIgnored,
    ...inputProps
  } = rest;
  void _valueIgnored;
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useMemo(() => id ?? `${field.name}-file-input`, [field.name, id]);
  const selectedFileName = useMemo(() => {
    if (typeof selectedFileNameProp === "string") {
      return selectedFileNameProp.length > 0 ? selectedFileNameProp : null;
    }
    return field.value instanceof File ? field.value.name : null;
  }, [field.value, selectedFileNameProp]);

  const revokePreviewUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    setPreview(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    return () => {
      revokePreviewUrl(preview);
    };
  }, [preview, revokePreviewUrl]);

  const handleRemove = async () => {
    const shouldRemove = onRemove ? await onRemove() : true;
    if (!shouldRemove) return;
    field.onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    revokePreviewUrl(preview);
    setPreview(null);
    setInputKey((k) => k + 1);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChangeProp?.(event);
    const file = event.target.files?.[0] ?? null;
    field.onChange(file);
    onSelect?.(file);
    if (file) {
      revokePreviewUrl(preview);
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      revokePreviewUrl(preview);
      setPreview(null);
    }
  };

  return (
    <Block space="sm" className={cn("w-full", containerClassName)}>
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <div className="flex w-full flex-col items-center gap-3">
          {preview && (
            <div className="relative flex max-w-full items-center justify-center">
              <div className="relative overflow-hidden rounded bg-muted p-2">
                <img src={preview} alt="preview" className="max-h-40 w-auto object-contain" />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleRemove();
                }}
              >
                <XIcon className="size-5" />
                <span className="sr-only">画像を削除</span>
              </Button>
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            {selectedFileName ? (
              <span className="break-all text-center font-medium">
                選択中: {selectedFileName}
              </span>
            ) : (
              <span className="text-center font-medium text-muted-foreground">
                クリックしてファイルを選択
              </span>
            )}
          </div>
        </div>
      </label>
      <input
        key={inputKey}
        id={inputId}
        type="file"
        name={field.name}
        ref={(el) => {
          inputRef.current = el;
          field.ref(el);
        }}
        disabled={disabled}
        onBlur={field.onBlur}
        className="sr-only"
        {...inputProps}
        onChange={handleChange}
      />
    </Block>
  );
};
