// src/features/card/components/common/CreateCardForm.tsx
"use client";

import { useForm } from "react-hook-form";

import { useCardFormOptions } from "../../hooks/useCardFormOptions";
import { useImageUploaderField } from "@/hooks/useImageUploaderField";
import { useRouteChangeEffect } from "@/hooks/useRouteChangeEffect";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { CardCreateSchema } from "@/features/card/entities/schema";
import { CardCreateFields } from "@/features/card/entities/form";
import { useCreateCard } from "../../hooks/useCreateCard";
import { CardForm } from "./CardForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useCardRarities } from "@/features/cardRarity/hooks/useCardRarities";
import { useCardTags } from "@/features/cardTag/hooks/useCardTags";
import { useSeries } from "@/features/series/hooks/useSeries";

type Props = {
  redirectPath?: string;
};

export default function CreateCardForm({ redirectPath = "/" }: Props) {
  const methods = useForm<CardCreateFields>({
    resolver: zodResolver(CardCreateSchema) as Resolver<CardCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: "",
      rarityId: "",
      name: "",
      modelNumber: "",
      marketPrice: undefined,
      pointValue: undefined,
      cardType: "real",
      state: "active",
      description: "",
      tagIds: [],
      seriesIds: [],
      mainImageUrl: "",
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

  const { upload, remove, markDeleted } = useImageUploaderField(
    methods,
    "mainImageUrl",
    "cards/main",
  );

  useRouteChangeEffect(() => {
    const url = methods.getValues("mainImageUrl");
    if (!url) return;
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ pathOrUrl: url })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/storage/delete", blob);
    } else {
      void remove(url);
    }
    markDeleted();
  });

  const { trigger, isMutating } = useCreateCard();

  const submit = async (data: CardCreateFields) => {
    try {
      await trigger({
        ...data,
      });
      toast.success("カードを登録しました");
      markDeleted();
      methods.setValue("mainImageUrl", "");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <CardForm
      methods={methods}
      onSubmitAction={submit}
      titleOptions={titleOptions}
      rarityOptions={rarityOptions}
      tagOptions={tagOptions}
      seriesOptions={seriesOptions}
      onUpload={upload}
      onDelete={remove}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
