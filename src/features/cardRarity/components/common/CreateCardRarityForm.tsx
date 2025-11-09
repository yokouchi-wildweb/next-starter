// src/features/cardRarity/components/common/CreateCardRarityForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardRarityCreateSchema } from "@/features/cardRarity/entities/schema";
import { CardRarityCreateFields } from "@/features/cardRarity/entities/form";
import { useCreateCardRarity } from "../../hooks/useCreateCardRarity";
import { CardRarityForm } from "./CardRarityForm";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateCardRarityForm({ redirectPath = "/" }: Props) {
  const methods = useForm<CardRarityCreateFields>({
    resolver: zodResolver(CardRarityCreateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: "",
      name: "",
      sortOrder: undefined,
      description: "",
    },
  });

  const router = useRouter();
  const { data: titles } = useTitles({ suspense: true });

  const { trigger, isMutating } = useCreateCardRarity();

  const submit = async (data: CardRarityCreateFields) => {
    try {
      await trigger({
        ...data,
        sortOrder: data.sortOrder ?? undefined,
        description: data.description || undefined,
      });
      toast.success("レアリティを登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  const titleOptions = titles.map((t) => ({ value: t.id, label: t.name }));

  return (
    <CardRarityForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      titleOptions={titleOptions}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
