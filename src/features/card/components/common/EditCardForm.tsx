// src/features/card/components/common/EditCardForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { useImageUploaderField } from "@/hooks/useImageUploaderField";
import { useCardFormOptions } from "../../hooks/useCardFormOptions";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardUpdateSchema } from "@/features/card/entities/schema";
import { CardUpdateFields } from "@/features/card/entities/form";
import { useUpdateCard } from "../../hooks/useUpdateCard";
import { CardForm } from "./CardForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";
import { useFieldGuard } from "@/hooks/useFieldGuard";
import type { CardWithRelations } from "@/features/card/entities";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useCardRarities } from "@/features/cardRarity/hooks/useCardRarities";
import { useCardTags } from "@/features/cardTag/hooks/useCardTags";
import { useSeries } from "@/features/series/hooks/useSeries";

type Props = {
  card: CardWithRelations;
  redirectPath?: string;
};

export default function EditCardForm({ card, redirectPath = "/" }: Props) {
  const methods = useForm<CardUpdateFields>({
    resolver: zodResolver(CardUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: card.titleId,
      rarityId: card.rarityId,
      name: card.name,
      modelNumber: card.modelNumber ?? "",
      marketPrice: card.marketPrice ?? undefined,
      pointValue: card.pointValue ?? undefined,
      cardType: card.cardType as "real" | "virtual",
      state: card.state as "active" | "inactive",
      description: card.description ?? "",
      tagIds: card.tagIds,
      seriesIds: card.seriesIds,
      mainImageUrl: card.mainImageUrl ?? "",
    },
  });

  const router = useRouter();
  const { data: titles } = useTitles({ suspense: true });
  const { data: rarities } = useCardRarities({ suspense: true });
  const { data: tags } = useCardTags({ suspense: true });
  const { data: series } = useSeries({ suspense: true });

  const titleOptions = titles.map((t) => ({ value: t.id, label: t.name }));
  const tagOptions = tags.map((t) => ({ value: t.id, label: t.name }));
  const { rarityOptions, seriesOptions } = useCardFormOptions(
    methods,
    rarities,
    series,
  );

  const { trigger, isMutating } = useUpdateCard();

  const { upload: handleUpload, remove: handleDelete } = useImageUploaderField(
    methods,
    "mainImageUrl",
    "cards/main",
    false,
  );

  const submit = async (data: CardUpdateFields) => {
    try {
      await trigger({
        id: card.id,
        data: {
          ...data,
        },
      });
      toast.success("カードを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };


  const canCancel = useFieldGuard(methods, "mainImageUrl", {
    onMissing: () =>
      toast.error("画像が削除されているためキャンセルできません"),
    allowProceed: false,
  });

  const handleCancel = () => {
    if (!canCancel()) return;
    router.push(redirectPath);
  };

  return (
    <CardForm
      methods={methods}
      onSubmitAction={submit}
      titleOptions={titleOptions}
      rarityOptions={rarityOptions}
      tagOptions={tagOptions}
      seriesOptions={seriesOptions}
      mainImageUrl={card.mainImageUrl ?? undefined}
      onUpload={handleUpload}
      onDelete={handleDelete}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="処理中..."
      onCancel={handleCancel}
    />
  );
}
