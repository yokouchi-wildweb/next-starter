"use client";

import type { CardWithNames } from "@/features/card/entities";
import { gachaClient } from "../services/client/gachaClient";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

// ガチャを引くためのカスタムフック

export const useDrawGacha = () => {
  // SWR のミューテーションを使ってガチャAPIを呼び出す
  const mutation = useSWRMutation<CardWithNames[], HttpError, string, { count: number }>(
    "gacha/draw",
    (_key, { arg }) => gachaClient.draw(arg.count),
  );

  return {
    trigger: (count: number) =>
      (mutation.trigger as (arg: { count: number }) => Promise<CardWithNames[]>)(
        { count },
      ),
    data: mutation.data,
    isMutating: mutation.isMutating,
    error: mutation.error,
  };
};
