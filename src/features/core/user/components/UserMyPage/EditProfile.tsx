// src/features/core/user/components/UserMyPage/EditProfile.tsx

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderIcon } from "lucide-react";

import { AppForm } from "@/components/Form/AppForm";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Button } from "@/components/Form/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { useUpdateMyProfile } from "@/features/core/user/hooks/useUpdateMyProfile";
import type { User } from "@/features/core/user/entities";
import {
  RoleProfileFields,
  getProfilesByCategory,
} from "@/features/core/userProfile/components/common";
import {
  createProfileDataValidator,
  getProfilesByCategory as getProfilesByCategoryUtil,
} from "@/features/core/userProfile/utils";

import { AccountPageHeader } from "./AccountPageHeader";
import { z } from "zod";

// --- スキーマ ---

const validateProfileData = createProfileDataValidator(
  getProfilesByCategoryUtil("user"),
  "selfEdit"
);

const FormSchema = z
  .object({
    name: z.string().trim(),
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

type FormValues = {
  name: string;
  role: string;
  profileData?: Record<string, unknown>;
};

// --- コンポーネント ---

type EditProfileProps = {
  user: User;
  profileData?: Record<string, unknown>;
};

export function EditProfile({ user, profileData }: EditProfileProps) {
  const router = useRouter();
  const { updateProfile, isLoading, error } = useUpdateMyProfile();

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: user.name ?? "",
      role: user.role,
      profileData: profileData ?? {},
    },
  });

  const { control, formState: { isSubmitting } } = methods;
  const loading = isLoading || isSubmitting;

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      const trimmedName = values.name?.trim() ?? "";
      const resolvedName = trimmedName.length > 0 ? trimmedName : null;

      const result = await updateProfile({
        name: resolvedName ?? "",
        profileData: values.profileData,
      });
      if (result) {
        router.push("/mypage/account");
        router.refresh();
      }
    },
    [updateProfile, router]
  );

  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader
          title="プロフィール編集"
          backHref="/mypage/account"
          backDisabled={loading}
        />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <AppForm methods={methods} onSubmit={handleSubmit} pending={loading} fieldSpace={6}>
            <ControlledField
              control={control}
              name="name"
              label="ユーザー名"
              renderInput={(field) => <TextInput field={field} />}
            />
            <RoleProfileFields
              methods={methods}
              role={user.role}
              profiles={getProfilesByCategory("user")}
              tag="selfEdit"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading && <LoaderIcon className="h-4 w-4 animate-spin" />}
              {loading ? "保存中..." : "保存"}
            </Button>
          </AppForm>
        </div>
      </Stack>
    </Section>
  );
}
