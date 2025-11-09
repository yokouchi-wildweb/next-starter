// src/features/cardRarity/components/common/EditCardRarityForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardRarityUpdateSchema } from "@/features/cardRarity/entities/schema";
import { CardRarityUpdateFields } from "@/features/cardRarity/entities/form";
import type { CardRarity } from "@/features/cardRarity/entities";
import { useUpdateCardRarity } from "../../hooks/useUpdateCardRarity";
import { CardRarityForm } from "./CardRarityForm";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  rarity: CardRarity;
  redirectPath?: string;
};

export default function EditCardRarityForm({ rarity, redirectPath = "/" }: Props) {
  const methods = useForm<CardRarityUpdateFields>({
    resolver: zodResolver(CardRarityUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: rarity.titleId,
      name: rarity.name,
      sortOrder: rarity.sortOrder ?? undefined,
      description: rarity.description ?? "",
    },
  });

  const router = useRouter();
  const { data: titles } = useTitles({ suspense: true });

  const { trigger, isMutating } = useUpdateCardRarity();

  const submit = async (data: CardRarityUpdateFields) => {
    try {
      await trigger({
        id: rarity.id,
        data: {
          ...data,
          sortOrder: data.sortOrder ?? undefined,
          description: data.description || undefined,
        },
      });
      toast.success("レアリティを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  const titleOptions = titles.map((t) => ({ value: t.id, label: t.name }));

  return (
    <CardRarityForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      titleOptions={titleOptions}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
