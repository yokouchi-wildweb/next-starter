// src/features/series/components/common/EditSeriesForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SeriesUpdateSchema } from "@/features/series/entities/schema";
import { SeriesUpdateFields } from "@/features/series/entities/form";
import type { Series } from "@/features/series/entities";
import { useUpdateSeries } from "../../hooks/useUpdateSeries";
import { SeriesForm } from "./SeriesForm";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  series: Series;
  redirectPath?: string;
};

export default function EditSeriesForm({ series, redirectPath = "/" }: Props) {
  const methods = useForm<SeriesUpdateFields>({
    resolver: zodResolver(SeriesUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      titleId: series.titleId,
      name: series.name,
      description: series.description ?? "",
      releaseDate: series.releaseDate ?? "",
    },
  });

  const router = useRouter();
  const { data: titles } = useTitles({ suspense: true });

  const { trigger, isMutating } = useUpdateSeries();

  const submit = async (data: SeriesUpdateFields) => {
    try {
      await trigger({
        id: series.id,
        data: {
          ...data,
          description: data.description || undefined,
          releaseDate: data.releaseDate || undefined,
        },
      });
      toast.success("シリーズを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  const titleOptions = titles.map((t) => ({ value: t.id, label: t.name }));

  return (
    <SeriesForm
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
