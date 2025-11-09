// src/features/series/components/common/CreateSeriesForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SeriesCreateSchema } from "@/features/series/entities/schema";
import { SeriesCreateFields } from "@/features/series/entities/form";
import { useCreateSeries } from "../../hooks/useCreateSeries";
import { SeriesForm } from "./SeriesForm";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateSeriesForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SeriesCreateFields>({
    resolver: zodResolver(SeriesCreateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: "",
      name: "",
      description: "",
      releaseDate: "",
    },
  });

  const router = useRouter();
  const { data: titles } = useTitles({ suspense: true });

  const { trigger, isMutating } = useCreateSeries();

  const submit = async (data: SeriesCreateFields) => {
    try {
      await trigger({
        ...data,
        description: data.description || undefined,
        releaseDate: data.releaseDate || undefined,
      });
      toast.success("シリーズを登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  const titleOptions = titles.map((t) => ({ value: t.id, label: t.name }));

  return (
    <SeriesForm
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
