"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "../revalidateRelatedCaches";
import {
  createConcurrentMutation,
  IDLE_MUTATION_SNAPSHOT,
  type ConcurrentMutation,
  type MutationSnapshot,
} from "./concurrentMutation";

/**
 * 全 mutation 系フック（useCreateDomain / useUpdateDomain / useDeleteDomain / useBulk*Domain 等）の
 * 共通実装。各フックは引数の詰め替えと戻り値の選択だけを担当する。
 *
 * useSWRMutation を使わない理由: 同一インスタンスでの並列 trigger で先行分の結果
 * （成功・失敗とも）が捨てられ undefined で resolve するため。詳細は concurrentMutation.ts。
 *
 * 維持している挙動:
 * - `mutate(key, promise, { populateCache: false, throwOnError: true })` 経由で実行するため、
 *   完了後の `key` 自身の再検証と SWR の mutation ウィンドウ（競合する revalidate の破棄）は従来どおり
 * - 成功時の revalidateRelatedCaches(revalidateKey)
 * - 戻り値シェイプ { trigger, isMutating, isLoading, error, data }
 * - trigger の identity は安定（key / fn / revalidateKey の最新値は呼び出し時に ref から読む）
 */

/** trigger 1 回分の作業。key / fn / revalidateKey を呼び出し時点の値で束ねる */
type MutationTask<T> = {
  run: () => Promise<T>;
  revalidate: () => Promise<void>;
};

export function useDomainMutation<T, Arg>(
  key: string,
  fn: (arg: Arg) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();
  const [snapshot, setSnapshot] = useState<MutationSnapshot<T, HttpError>>(
    IDLE_MUTATION_SNAPSHOT,
  );

  // 最新の引数は ref で保持し、render 中には読まない（trigger 呼び出し時にのみ参照する）
  const keyRef = useRef(key);
  const fnRef = useRef(fn);
  const revalidateKeyRef = useRef(revalidateKey);
  const mutateRef = useRef(mutate);
  useEffect(() => {
    keyRef.current = key;
    fnRef.current = fn;
    revalidateKeyRef.current = revalidateKey;
    mutateRef.current = mutate;
  });

  // コントローラーは最初の trigger 時に遅延生成（render 中に ref を触らないため）
  const controllerRef = useRef<ConcurrentMutation<T, MutationTask<T>, HttpError> | null>(null);

  const trigger = useCallback((arg: Arg): Promise<T> => {
    controllerRef.current ??= createConcurrentMutation<T, MutationTask<T>, HttpError>({
      execute: (task) => task.run(),
      onSuccess: (_data, task) => task.revalidate(),
      onChange: setSnapshot,
    });

    const mutateNow = mutateRef.current;
    const keyNow = keyRef.current;
    const fnNow = fnRef.current;
    const revalidateKeyNow = revalidateKeyRef.current;

    return controllerRef.current.trigger({
      run: () =>
        mutateNow<T, T>(keyNow, fnNow(arg), {
          populateCache: false,
          throwOnError: true,
        }) as Promise<T>,
      revalidate: async () => {
        if (revalidateKeyNow) {
          await revalidateRelatedCaches(mutateNow, revalidateKeyNow);
        }
      },
    });
  }, []);

  return {
    trigger,
    isMutating: snapshot.isMutating,
    isLoading: snapshot.isMutating,
    error: snapshot.error,
    data: snapshot.data,
  };
}
