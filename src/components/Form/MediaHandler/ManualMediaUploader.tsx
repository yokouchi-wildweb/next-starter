 "use client";

import { useCallback } from "react";

import { MediaUploader, type MediaUploaderProps } from "@/lib/mediaInputSuite";

type BaseProps = Omit<MediaUploaderProps, "initialUrl" | "onUrlChange">;

export type ManualMediaUploaderProps = BaseProps & {
  value?: string | null;
  defaultUrl?: string | null;
  onValueChange?: (url: string | null) => void;
  onUrlChange?: (url: string | null) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  onRegisterPendingUpload?: (url: string | null) => void;
  onRegisterPendingDelete?: (url: string | null) => void;
};

export const ManualMediaUploader = ({
  value,
  defaultUrl = null,
  onValueChange,
  onUrlChange,
  onUploadingChange,
  onRegisterPendingUpload,
  onRegisterPendingDelete,
  ...uploaderProps
}: ManualMediaUploaderProps) => {
  const resolvedInitialUrl = value ?? defaultUrl ?? null;

  const handleUrlChange = useCallback(
    (url: string | null) => {
      onValueChange?.(url);
      onUrlChange?.(url);
    },
    [onUrlChange, onValueChange],
  );

  return (
    <MediaUploader
      {...uploaderProps}
      initialUrl={resolvedInitialUrl}
      onUrlChange={handleUrlChange}
      onUploadingChange={onUploadingChange}
      onRegisterPendingUpload={onRegisterPendingUpload}
      onRegisterPendingDelete={onRegisterPendingDelete}
    />
  );
};
