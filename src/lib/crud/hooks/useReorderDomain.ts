"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

type ReorderArg = {
  id: string;
  afterItemId: string | null;
};

/**
 * 並び替え用フック
 * @param key SWRキャッシュキー
 * @param reorderFn クライアントサービスのreorderメソッド
 * @param revalidateKey 成功時に再取得するキャッシュキー
 */
export function useReorderDomain<T>(
  key: string,
  reorderFn: (id: string, afterItemId: string | null) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T, HttpError, string, ReorderArg>(
    key,
    (_key, { arg }) => reorderFn(arg.id, arg.afterItemId),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (id: string, afterItemId: string | null) =>
      (mutation.trigger as (arg: ReorderArg) => Promise<T>)({ id, afterItemId }),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
