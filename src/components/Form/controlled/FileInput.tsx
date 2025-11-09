// src/components/Form/FileInput.tsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Form/button/Button";
import { Input } from "@/components/Form/manual";
import { Block } from "@/components/Layout/Block";
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
};

export const FileInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: FileInputProps<TFieldValues, TName>) => {
  const { field, initialUrl = null, onSelect, onRemove, ...rest } = props;
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPreview(initialUrl);
  }, [initialUrl]);

  const handleRemove = async () => {
    const shouldRemove = onRemove ? await onRemove() : true;
    if (!shouldRemove) return;
    field.onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setPreview(null);
    setInputKey((k) => k + 1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    field.onChange(file);
    onSelect?.(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  return (
    <Block space="sm">
      {preview && (
        <div className="relative flex items-center justify-center rounded bg-muted p-2">
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-1 top-1"
            onClick={handleRemove}
          >
            <XIcon className="size-5" />
            <span className="sr-only">画像を削除</span>
          </Button>
          <img src={preview} alt="preview" className="max-h-40 w-auto object-contain" />
        </div>
      )}
      <Input
        key={inputKey}
        type="file"
        ref={(el) => {
          inputRef.current = el;
          field.ref(el);
        }}
        {...rest}
        onChange={handleChange}
      />
    </Block>
  );
};
