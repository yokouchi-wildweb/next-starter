// src/features/bar/components/common/CreateBarForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarCreateSchema } from "@/features/bar/entities/schema";
import { BarCreateFields } from "@/features/bar/entities/form";
import { useCreateBar } from "../../hooks/useCreateBar";
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
  redirectPath?: string;
};

export default function CreateBarForm({ redirectPath = "/" }: Props) {
  const methods = useForm<BarCreateFields>({
    resolver: zodResolver(BarCreateSchema) as Resolver<BarCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: "",
      rarityId: "",
      tagIds: [],
      seriesIds: [],
      name: "",
      modelNumber: "",
      marketPrice: undefined,
      pointValue: undefined,
      cardType: undefined,
      state: undefined,
      description: "",
      mainImageUrl: "",
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

  const { upload: uploadMain, remove: removeMain } = useImageUploaderField(methods, "mainImageUrl", "bar/main");

  const router = useRouter();

  const { trigger, isMutating } = useCreateBar();

  const submit = async (data: BarCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
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
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
