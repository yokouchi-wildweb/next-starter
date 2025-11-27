// src/features/setting/components/common/SettingForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SettingFields } from "./SettingFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
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
  const lightUrlRef = useRef(methods.getValues("adminHeaderLogoImageUrl" as keyof TFieldValues) ?? null);
  const darkUrlRef = useRef(methods.getValues("adminHeaderLogoImageDarkUrl" as keyof TFieldValues) ?? null);
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
    methods.setValue("adminHeaderLogoImageUrl" as keyof TFieldValues, lightUrlRef.current as any);
    methods.setValue("adminHeaderLogoImageDarkUrl" as keyof TFieldValues, darkUrlRef.current as any);
  }, [cleanupUploads, methods, revertDarkDeletion, revertLightDeletion]);

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
        defaultLightLogoUrl={lightUrlRef.current}
        defaultDarkLogoUrl={darkUrlRef.current}
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
