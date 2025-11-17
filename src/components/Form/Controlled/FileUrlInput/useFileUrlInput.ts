import { useEffect, useState } from "react";
import type {
  FieldPath,
  FieldValues,
  ControllerRenderProps,
} from "react-hook-form";

import type { FileUrlOptions } from "./types";

export type UseFileUrlInputParams<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FileUrlOptions & {
  field: ControllerRenderProps<TFieldValues, TName>;
};

export const useFileUrlInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(params: UseFileUrlInputParams<TFieldValues, TName>) => {
  const { field, onUpload, onDelete, initialUrl = null, onPendingChange } =
    params;
  const [url, setUrl] = useState<string | null>(field.value ?? initialUrl);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(
    null,
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (field.value !== undefined) {
      setUrl((field.value as string) || null);
    } else {
      setUrl(initialUrl ?? null);
    }
    if (!field.value && !initialUrl) {
      setSelectedFileName(null);
    }
  }, [initialUrl, field.value]);

  const dummyField = {
    name: `${String(field.name)}-file`,
    value: undefined,
    onChange: () => {},
    onBlur: () => {},
    ref: () => {},
  } as unknown as ControllerRenderProps<TFieldValues, TName>;

  const handleSelect = async (file: File | null) => {
    if (!file) return;
    if (typeof onUpload !== "function") {
      console.error("FileUrlInput: onUpload callback is required");
      return;
    }
    setPending(true);
    try {
      const uploaded = await onUpload(file);
      setUrl(uploaded);
      field.onChange(uploaded as unknown as TFieldValues[TName]);
      setSelectedFileName(file.name);
    } catch (e) {
      console.error(e);
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async () => {
    setPending(true);
    try {
      if (url && onDelete) {
        await onDelete(url);
      }
      setUrl(null);
      field.onChange("" as unknown as TFieldValues[TName]);
      setSelectedFileName(null);
    } catch (e) {
      console.error(e);
    } finally {
      setPending(false);
    }
  };

  const requestDelete = () => {
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && resolver) {
      resolver(false);
      setResolver(null);
    }
    setOpen(v);
  };

  const confirmDelete = async () => {
    resolver?.(true);
    setResolver(null);
    await handleRemove();
    setOpen(false);
  };

  return {
    url,
    pending,
    open,
    dummyField,
    selectedFileName,
    handleSelect,
    requestDelete,
    handleOpenChange,
    confirmDelete,
  } as const;
};

