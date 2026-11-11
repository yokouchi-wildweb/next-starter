// src/lib/task/index.ts — ドメインのタスク・移行の定義の型と、書き込み前に止まった印(公開の入口はこの 1 つ)
// 定義は src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts の export const task(README.md)。
// ランナーは scripts/runner/task(pnpm task、実行のたびに task_runs へ記録)。依存なし(features・棚を読まない)。

/** ドメインのタスク・移行(src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts の export const task)。定期実行はされない */
export type OneShotTask = {
  /** pnpm task の名前 = <ドメイン>:<ファイル名>(タスクか移行かは置いたフォルダで決まる) */
  name: string;
  /**
   * 移行だけ(必須): 案内する notice の id。止める鍵 migration:<notice の id>:<名前> が常に掛かる
   * (一度成功・結果不明になった移行は二度と自動では走らない)
   */
  notice?: string;
  /**
   * タスクだけ(任意): 止める鍵を引数から返す。同じ鍵が成功・結果不明・走っている行にあれば実行を拒否する。
   * 代わりになる 2 本は同じ鍵を返す(例 wallet:lots-init と wallet:lots-init-from-history は通貨ごとに wallet-lots:<通貨>)。
   * 使い方の誤りは TaskNotStartedError で投げる
   */
  stopKeys?: (args: string[]) => string[] | Promise<string[]>;
  /** 重い依存は run の中で動的 import する。引数は process.argv.slice(3)(`--` を除く) */
  run: () => Promise<Record<string, unknown>>;
};

/**
 * 書き込みの前に止まった(使い方の誤り・対象の検証で拒否した)印。記録は failed になり、止める鍵を取らない(直してもう一度打てる)。
 * これ以外の失敗は、止める鍵のある実行なら結果不明(unknown: どこまで書いたか分からない。人が確かめて pnpm task --resolve)
 */
export class TaskNotStartedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskNotStartedError";
  }
}

/**
 * 書き込んだ後の失敗だが、打ち直してよい印(冪等なタスクが自分で確かめて失敗とした時。例: 写しの後の照合が合わない)。
 * 記録は failed(止める鍵を取らない = 直してすぐ打ち直せる)、result も残す。冪等でないタスクは使わない(結果不明にする)
 */
export class TaskRerunnableError extends Error {
  readonly result: Record<string, unknown> | undefined;
  constructor(message: string, result?: Record<string, unknown>) {
    super(message);
    this.name = "TaskRerunnableError";
    this.result = result;
  }
}

/** 予算(時間)で区切りよく止まった結果の印。ランナーはこの値を incomplete と記録する(鍵を取らない) */
export type TaskIncompleteResult = Record<string, unknown> & { incomplete: true };

/**
 * 予算で止まった時に run が返す値(続きは同じ命令をもう一度打つ)。書いた所までが確かで、打ち直すと続きから進むタスクだけが使う。
 * 記録は incomplete(止める鍵を取らない。移行でも同じ移行をもう一度走らせられる)、result はそのまま残す
 */
export function taskIncomplete(result: Record<string, unknown> = {}): TaskIncompleteResult {
  return { ...result, incomplete: true };
}

/** run の返り値が予算で止まった印か(ランナーが読む) */
export function isTaskIncomplete(result: Record<string, unknown> | undefined | null): boolean {
  return result?.incomplete === true;
}
