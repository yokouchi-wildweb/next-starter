// src/lib/startup/createStartup.ts
// 起動時の処理の芯: 項目を読み込み、runtime の合う物を互いに独立に走らせる(項目ごとに待ち時間の上限)。register は throw しない
import type { StartupOptions, StartupTask, StartupTaskLoader } from "./types";

export type Startup = {
  /** Next の instrumentation の register にそのまま渡す */
  register: () => Promise<void>;
};

const TIMED_OUT = Symbol("timedOut");

/** 上限までだけ待つ(上限越えは TIMED_OUT。待った後の続きは止めない) */
async function withLimit<T>(work: () => T | Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([Promise.resolve().then(work), limit]);
  } finally {
    clearTimeout(timer);
  }
}

const runsHere = (task: StartupTask, runtime: "nodejs" | "edge") => {
  const want = task.runtime ?? "nodejs";
  return want === "both" || want === runtime;
};

const describe = (reason: unknown) =>
  reason === TIMED_OUT
    ? "timeout"
    : reason instanceof Error
      ? { name: reason.name, message: reason.message, ...(reason.stack ? { stack: reason.stack } : {}) }
      : { message: String(reason) };

export function createStartup(loaders: readonly StartupTaskLoader[], options: StartupOptions): Startup {
  const fail = (task: string, phase: "load" | "run", reason: unknown) => {
    try {
      (options.write ?? console.error)(JSON.stringify({ level: "error", scope: "startup", task, phase, reason: describe(reason) }));
    } catch {
      // 書き手の失敗は飲む(記録のための記録はしない)
    }
  };

  return {
    async register() {
      await Promise.all(
        loaders.map(async (loader) => {
          let task: StartupTask;
          try {
            task = await loader.load();
          } catch (reason) {
            fail(loader.name, "load", reason);
            return;
          }
          if (!runsHere(task, options.runtime)) return;
          try {
            const result = await withLimit(() => task.run(), options.timeoutMs);
            if (result === TIMED_OUT) fail(task.name, "run", TIMED_OUT);
          } catch (reason) {
            fail(task.name, "run", reason);
          }
        }),
      );
    },
  };
}
