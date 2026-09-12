/**
 * 並列 trigger 安全な mutation の中核（React 非依存の純ロジック）。
 *
 * 背景: swr/mutation の useSWRMutation は「最後に開始した trigger」以外の結果を捨てる
 * （ditchMutationsUntilRef）。同一インスタンスで trigger() を並列に呼ぶと、先行分は
 * 成功でも失敗でも state 更新・onSuccess・throw のいずれも行わず undefined で resolve する。
 * その結果、Promise.all で束ねた一括保存が「途中の 1 件が 400 でも全件成功」に見える。
 *
 * ここでは trigger ごとに自分の結果を必ず resolve/reject し、in-flight 件数で isMutating を
 * 管理する。useDomainMutation がこれを React state に接続する。
 *
 * 契約:
 * - 失敗した trigger は必ずその error で reject する（並列数に依存しない）
 * - 成功した trigger は必ず T で resolve する（undefined は返さない）
 * - isMutating は 1 件でも in-flight がある間 true、全件 settle で false
 * - error / data は「直近に settle した trigger の結果」（逐次利用時は useSWRMutation と同じ）
 * - onSuccess（キャッシュ再検証）は成功した trigger ごとに await してから resolve する。
 *   再検証自体の失敗は書き込み成功を reject に変えないよう握り、console.error に流す
 */

export type MutationSnapshot<T, E> = {
  isMutating: boolean;
  error: E | undefined;
  data: T | undefined;
};

export type ConcurrentMutationOptions<T, Arg, E> = {
  /** 実際の書き込み（ClientService 呼び出し等） */
  execute: (arg: Arg) => Promise<T>;
  /** 成功時の後処理（キャッシュ再検証等）。resolve 前に await される */
  onSuccess?: (data: T, arg: Arg) => Promise<void> | void;
  /** state 変化通知。React 側は setState に接続する */
  onChange?: (snapshot: MutationSnapshot<T, E>) => void;
};

export type ConcurrentMutation<T, Arg, E> = {
  trigger: (arg: Arg) => Promise<T>;
  getSnapshot: () => MutationSnapshot<T, E>;
};

export const IDLE_MUTATION_SNAPSHOT: MutationSnapshot<never, never> = Object.freeze({
  isMutating: false,
  error: undefined,
  data: undefined,
});

export function createConcurrentMutation<T, Arg, E = unknown>(
  options: ConcurrentMutationOptions<T, Arg, E>,
): ConcurrentMutation<T, Arg, E> {
  let pending = 0;
  let error: E | undefined;
  let data: T | undefined;

  const getSnapshot = (): MutationSnapshot<T, E> => ({
    isMutating: pending > 0,
    error,
    data,
  });

  const emit = () => {
    options.onChange?.(getSnapshot());
  };

  const trigger = async (arg: Arg): Promise<T> => {
    pending += 1;
    emit();
    try {
      const result = await options.execute(arg);
      data = result;
      error = undefined;
      if (options.onSuccess) {
        try {
          await options.onSuccess(result, arg);
        } catch (revalidateError) {
          // 書き込みは成功している。再検証の失敗で呼び出し元を reject させると
          // 利用者が再送して二重書き込みになるため、ここで握って記録のみ行う
          console.error("[crud/hooks] onSuccess (revalidate) failed after a successful mutation", revalidateError);
        }
      }
      return result;
    } catch (e) {
      error = e as E;
      throw e;
    } finally {
      pending -= 1;
      emit();
    }
  };

  return { trigger, getSnapshot };
}
