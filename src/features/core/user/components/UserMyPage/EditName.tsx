// src/features/core/user/components/UserMyPage/EditName.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Input/Manual/Input";
import { Label } from "@/components/Form/Label";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { useUpdateMyProfile } from "@/features/core/user/hooks/useUpdateMyProfile";

import { AccountPageHeader } from "./AccountPageHeader";

type EditNameProps = {
  currentName: string | null;
};

export function EditName({ currentName }: EditNameProps) {
  const router = useRouter();
  const { updateProfile, isLoading, error } = useUpdateMyProfile();
  const [editName, setEditName] = useState(currentName ?? "");

  const handleSave = useCallback(async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) return;

    const result = await updateProfile({ name: trimmedName });
    if (result) {
      router.push("/mypage/account");
      router.refresh();
    }
  }, [editName, updateProfile, router]);

  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader
          title="ユーザー名を編集"
          backHref="/mypage/account"
          backDisabled={isLoading}
        />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Stack space={4}>
            <div>
              <Label htmlFor="display-name" className="mb-2 block">
                ユーザー名
              </Label>
              <Input
                type="text"
                id="display-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="ユーザー名を入力"
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !editName.trim()}
              className="w-full"
            >
              {isLoading && <LoaderIcon className="h-4 w-4 animate-spin" />}
              {isLoading ? "保存中..." : "保存"}
            </Button>
          </Stack>
        </div>
      </Stack>
    </Section>
  );
}
