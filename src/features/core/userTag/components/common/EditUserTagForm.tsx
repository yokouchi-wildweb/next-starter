// src/features/userTag/components/common/EditUserTagForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserTagUpdateSchema } from "@/features/core/userTag/entities/schema";
import type { UserTagUpdateFields } from "@/features/core/userTag/entities/form";
import type { UserTag } from "@/features/core/userTag/entities";
import { useUpdateUserTag } from "@/features/core/userTag/hooks/useUpdateUserTag";
import { useSearchUserTag } from "@/features/core/userTag/hooks/useSearchUserTag";
import { UserTagForm } from "./UserTagForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { getAdminPaths } from "@/lib/crud/utils/paths";
import domainConfig from "@/features/core/userTag/domain.json";

const adminPaths = getAdminPaths(domainConfig.plural);

type Props = {
  userTag: UserTag;
  redirectPath?: string;
};

export default function EditUserTagForm({ userTag, redirectPath = "/" }: Props) {
  const methods = useForm<UserTagUpdateFields>({
    resolver: zodResolver(UserTagUpdateSchema) as Resolver<UserTagUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, userTag) as UserTagUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateUserTag();
  const { data: items } = useSearchUserTag({ limit: 10 });

  const { navigator, isSwitching } = useItemNavigator({
    items,
    currentItem: userTag,
    getPath: adminPaths.edit,
    methods,
    updateTrigger: trigger,
    isMutating,
  });

  useLoadingToast(isMutating, isSwitching ? "アイテムを切り替え中" : "更新中です…");

  const submit = async (data: UserTagUpdateFields) => {
    try {
      await trigger({ id: userTag.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <>
      {navigator}
      <UserTagForm
        methods={methods}
        onSubmitAction={submit}
        isMutating={isMutating}
        submitLabel="更新"
        onCancel={() => router.push(redirectPath)}
      />
    </>
  );
}
