// src/features/bar/components/common/EditBarForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarUpdateSchema } from "@/features/bar/entities/schema";
import type { BarUpdateFields } from "@/features/bar/entities/form";
import type { Bar } from "@/features/bar/entities";
import { useUpdateBar } from "../../hooks/useUpdateBar";
import { BarForm } from "./BarForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useCardRarities } from "@/features/cardRarity/hooks/useCardRarities";
import { useCardTags } from "@/features/cardTag/hooks/useCardTags";
import { useSeries } from "@/features/series/hooks/useSeries";
import { useImageUploaderField } from "@/hooks/useImageUploaderField";

type Props = {
  bar: Bar;
  redirectPath?: string;
};

export default function EditBarForm({ bar, redirectPath = "/" }: Props) {
  const methods = useForm<BarUpdateFields>({
    resolver: zodResolver(BarUpdateSchema) as Resolver<BarUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: bar.titleId ?? "",
      rarityId: bar.rarityId ?? "",
      tagIds: bar.tagIds ?? [],
      seriesIds: bar.seriesIds ?? [],
      name: bar.name ?? "",
      modelNumber: bar.modelNumber ?? "",
      marketPrice: bar.marketPrice ?? undefined,
      pointValue: bar.pointValue ?? undefined,
      cardType: bar.cardType ?? undefined,
      state: bar.state ?? undefined,
      description: bar.description ?? "",
      mainImageUrl: bar.mainImageUrl ?? "",
    },
  });

    const { data: titles } = useTitles({ suspense: true });
  const { data: cardRarities } = useCardRarities({ suspense: true });
  const { data: cardTags } = useCardTags({ suspense: true });
  const { data: series } = useSeries({ suspense: true });

  const titleOptions = titles.map((v) => ({ value: v.id, label: v.name }));
  const cardRarityOptions = cardRarities.map((v) => ({ value: v.id, label: v.name }));
  const cardTagOptions = cardTags.map((v) => ({ value: v.id, label: v.name }));
  const seriesOptions = series.map((v) => ({ value: v.id, label: v.name }));

  const { upload: uploadMain, remove: removeMain } = useImageUploaderField(methods, "mainImageUrl", "bar/main", false);

  const router = useRouter();

  const { trigger, isMutating } = useUpdateBar();

  const submit = async (data: BarUpdateFields) => {
    try {
      await trigger({ id: bar.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <BarForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      titleOptions={titleOptions}
      cardRarityOptions={cardRarityOptions}
      cardTagOptions={cardTagOptions}
      seriesOptions={seriesOptions}
      onUploadMain={uploadMain}
      onDeleteMain={removeMain}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
