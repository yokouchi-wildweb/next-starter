// src/features/core/notification/components/AdminNotificationSend/index.tsx
// お知らせ送信フォーム

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppForm, ControlledField } from "@/components/Form";
import {
  TextInput,
  Textarea,
  SelectInput,
  RadioGroupInput,
  MultiSelectInput,
  DatetimeInput,
} from "@/components/Form/Input/Controlled";
import { ControlledMediaUploader } from "@/components/Form/MediaHandler/ControlledMediaUploader";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { useToast } from "@/lib/toast";
import { useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { sendNotification } from "@/features/notification/services/client/userNotificationClient";
import { getAllRoleOptions } from "@/features/core/user/utils/roleHelpers";
import { UserAsyncMultiSelect } from "@/features/user/components/common/UserAsyncMultiSelect";
import { Send } from "lucide-react";

// --- スキーマ ---

const SendFormSchema = z
  .object({
    title: z.string().trim().optional(),
    body: z.string().trim().min(1, { message: "本文は必須です。" }),
    image: z.string().nullish(),
    targetType: z.enum(["all", "role", "individual"]),
    targetRoles: z.array(z.string()).optional(),
    targetUserIds: z.array(z.string()).optional(),
    sendTiming: z.enum(["immediate", "scheduled"]),
    publishedAt: z.date().nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.targetType === "role" && (!data.targetRoles || data.targetRoles.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "対象ロールを1件以上選択してください。",
        path: ["targetRoles"],
      });
    }
    if (data.targetType === "individual" && (!data.targetUserIds || data.targetUserIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "対象ユーザーを1件以上選択してください。",
        path: ["targetUserIds"],
      });
    }
    if (data.sendTiming === "scheduled" && !data.publishedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "送信日時を指定してください。",
        path: ["publishedAt"],
      });
    }
  });

type SendFormValues = z.infer<typeof SendFormSchema>;

// --- オプション ---

const targetTypeOptions = [
  { label: "全員", value: "all" },
  { label: "ロール指定", value: "role" },
  { label: "個別ユーザー", value: "individual" },
];

const sendTimingOptions = [
  { label: "今すぐ送信", value: "immediate" },
  { label: "日時指定", value: "scheduled" },
];

const roleOptions = getAllRoleOptions().map((role) => ({
  label: role.name,
  value: role.id,
}));

// --- コンポーネント ---

export default function AdminNotificationSend() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  useLoadingToast(isSending, "送信中です…");

  const methods = useForm<SendFormValues>({
    resolver: zodResolver(SendFormSchema),
    mode: "onSubmit",
    defaultValues: {
      title: "",
      body: "",
      image: null,
      targetType: "all",
      targetRoles: [],
      targetUserIds: [],
      sendTiming: "immediate",
      publishedAt: null,
    },
  });

  const targetType = methods.watch("targetType");
  const sendTiming = methods.watch("sendTiming");

  const handleSubmit = useCallback(
    async (data: SendFormValues) => {
      setIsSending(true);
      try {
        await sendNotification({
          title: data.title || null,
          body: data.body,
          image: data.image || null,
          targetType: data.targetType,
          targetRoles: data.targetType === "role" ? data.targetRoles : null,
          targetUserIds: data.targetType === "individual" ? data.targetUserIds : null,
          publishedAt:
            data.sendTiming === "scheduled" && data.publishedAt
              ? data.publishedAt.toISOString()
              : null,
        });
        showToast(
          data.sendTiming === "scheduled" ? "お知らせを予約しました" : "お知らせを送信しました",
          "success"
        );
        router.push("/admin/notifications");
      } catch (error) {
        showToast(err(error, "送信に失敗しました"), "error");
      } finally {
        setIsSending(false);
      }
    },
    [router, showToast]
  );

  return (
    <AppForm methods={methods} onSubmit={handleSubmit} pending={isSending} fieldSpace={6}>
      <Section>
        <Stack space={6}>
          <ControlledField
            control={methods.control}
            name="title"
            label="タイトル"
            renderInput={(field) => <TextInput field={field} placeholder="タイトル（任意）" />}
          />

          <ControlledField
            control={methods.control}
            name="body"
            label="本文"
            required
            renderInput={(field) => <Textarea field={field} placeholder="お知らせの本文を入力" />}
          />

          <ControlledField
            control={methods.control}
            name="image"
            label="画像"
            renderInput={(field) => (
              <ControlledMediaUploader
                field={field}
                uploadPath="notification/image"
                accept="image/*"
                onUploadingChange={setIsUploading}
              />
            )}
          />

          <ControlledField
            control={methods.control}
            name="targetType"
            label="送信対象"
            required
            renderInput={(field) => <SelectInput field={field} options={targetTypeOptions} />}
          />

          {targetType === "role" && (
            <ControlledField
              control={methods.control}
              name="targetRoles"
              label="対象ロール"
              required
              renderInput={(field) => (
                <MultiSelectInput
                  field={field}
                  options={roleOptions}
                  placeholder="ロールを選択してください"
                />
              )}
            />
          )}

          {targetType === "individual" && (
            <ControlledField
              control={methods.control}
              name="targetUserIds"
              label="対象ユーザー"
              required
              renderInput={(field) => (
                <UserAsyncMultiSelect
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          )}

          <ControlledField
            control={methods.control}
            name="sendTiming"
            label="送信タイミング"
            required
            renderInput={(field) => (
              <RadioGroupInput
                field={field}
                options={sendTimingOptions}
                displayType="standard"
                orientation="horizontal"
              />
            )}
          />

          {sendTiming === "scheduled" && (
            <ControlledField
              control={methods.control}
              name="publishedAt"
              label="送信日時"
              required
              renderInput={(field) => <DatetimeInput field={field} />}
            />
          )}
        </Stack>
      </Section>

      <Flex gap="sm" justify="center" className="mt-6">
        <Button type="submit" variant="default" disabled={isSending || isUploading}>
          <Send className="h-4 w-4" />
          {sendTiming === "scheduled" ? "予約する" : "送信する"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/notifications")}
        >
          キャンセル
        </Button>
      </Flex>
    </AppForm>
  );
}
