// src/components/Form/FileUrlInput/FileUrlInput.tsx

import { Block } from "@/components/Layout/Block";

import { FileInput } from "../FileInput";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useFileUrlInput } from "./useFileUrlInput";
import type { Props } from "./types";
import type { FieldValues, FieldPath } from "react-hook-form";

export const FileUrlInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: Props<TFieldValues, TName>) => {
  const {
    field,
    onUpload,
    onDelete,
    initialUrl = null,
    onPendingChange,
    ...fileInputProps
  } = props;

  const {
    url,
    pending,
    open,
    dummyField,
    handleSelect,
    requestDelete,
    handleOpenChange,
    confirmDelete,
  } = useFileUrlInput({
    field,
    onUpload,
    onDelete,
    initialUrl,
    onPendingChange,
  });

  return (
    <Block space="sm">
      <FileInput
        {...fileInputProps}
        disabled={pending || fileInputProps.disabled}
        field={dummyField}
        initialUrl={url ?? undefined}
        onSelect={handleSelect}
        onRemove={requestDelete}
      />
      <input type="hidden" {...field} value={url ?? ""} />
      <DeleteConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        onConfirm={confirmDelete}
      />
    </Block>
  );
};

