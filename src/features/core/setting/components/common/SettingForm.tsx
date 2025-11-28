// src/features/setting/components/common/SettingForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SettingFields } from "./SettingFields";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { useCallback, useRef, useState } from "react";
import { usePendingMediaUploads, usePendingMediaDeletion } from "@/lib/mediaInputSuite";

export type SettingFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  processingLabel: string;
};

export function SettingForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
}: SettingFormProps<TFieldValues>) {
  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const loading = isSubmitting || isMutating;
  const [isUploading, setUploading] = useState(false);
  const disabled = loading || isUploading;
  const initialLightUrl = methods.getValues("adminHeaderLogoImageUrl" as Path<TFieldValues>);
  const initialDarkUrl = methods.getValues("adminHeaderLogoImageDarkUrl" as Path<TFieldValues>);
  const lightUrlRef = useRef<string | null>((initialLightUrl as string | null | undefined) ?? null);
  const darkUrlRef = useRef<string | null>((initialDarkUrl as string | null | undefined) ?? null);
  const {
    register: registerUploads,
    commit: commitUpload,
    cleanup: cleanupUploads,
  } = usePendingMediaUploads({ cleanupOnUnmount: true });
  const {
    markDelete: markDeleteLight,
    commit: commitLightDeletion,
    revert: revertLightDeletion,
  } = usePendingMediaDeletion();
  const {
    markDelete: markDeleteDark,
    commit: commitDarkDeletion,
    revert: revertDarkDeletion,
  } = usePendingMediaDeletion();

  const handleLightUrlChange = useCallback(
    (url: string | null) => {
      registerUploads(url);
    },
    [registerUploads],
  );

  const handleDarkUrlChange = useCallback(
    (url: string | null) => {
      registerUploads(url);
    },
    [registerUploads],
  );

  const handleSubmit = useCallback(
    async (data: TFieldValues) => {
      await onSubmitAction(data);
      const light = data["adminHeaderLogoImageUrl" as keyof TFieldValues] as string | null;
      const dark = data["adminHeaderLogoImageDarkUrl" as keyof TFieldValues] as string | null;
      commitUpload(light);
      commitUpload(dark);
      await commitLightDeletion();
      await commitDarkDeletion();
      lightUrlRef.current = light;
      darkUrlRef.current = dark;
    },
    [commitDarkDeletion, commitLightDeletion, commitUpload, onSubmitAction],
  );

  const handleCancel = useCallback(() => {
    void cleanupUploads();
    revertLightDeletion();
    revertDarkDeletion();
    methods.setValue("adminHeaderLogoImageUrl" as Path<TFieldValues>, lightUrlRef.current as any, {
      shouldDirty: false,
    });
    methods.setValue("adminHeaderLogoImageDarkUrl" as Path<TFieldValues>, darkUrlRef.current as any, {
      shouldDirty: false,
    });
  }, [cleanupUploads, methods, revertDarkDeletion, revertLightDeletion]);

  const defaultLightLogoUrl = lightUrlRef.current ?? null;
  const defaultDarkLogoUrl = darkUrlRef.current ?? null;

  return (
    <AppForm
      methods={methods}
      onSubmit={handleSubmit}
      pending={disabled}
      fieldSpace="md"
    >
      <SettingFields<TFieldValues>
        control={control}
        onUploadingChange={setUploading}
        onLightLogoUrlChange={handleLightUrlChange}
        onDarkLogoUrlChange={handleDarkUrlChange}
        defaultLightLogoUrl={defaultLightLogoUrl}
        defaultDarkLogoUrl={defaultDarkLogoUrl}
        onRegisterLightDelete={(url) => {
          if (url === lightUrlRef.current) markDeleteLight(url);
        }}
        onRegisterDarkDelete={(url) => {
          if (url === darkUrlRef.current) markDeleteDark(url);
        }}
      />
      <div className="flex justify-center">
        <Button type="submit" disabled={disabled} variant="default">
          {disabled ? processingLabel : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} className="ml-4">
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
