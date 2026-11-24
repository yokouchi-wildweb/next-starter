// src/lib/backends/statusTask.ts
// 起動時の知らせ(D14): 口の選んだ実装の isConfigured を起動ごとに 1 行で書く。止めない・投げない・env の値を出さない。
// 呼び手は生成物 src/wiring/startup.ts の起動時の一覧の行(pnpm generate extensions、選ぶ点ごと、D49): 持ち主の公開の入口の <点>BackendStatus を渡す。
// 型は起動時の処理の項目と同じ形(lib/startup を読まない)

import { NONE_IMPLEMENTATION } from "./reserved";
import type { BackendStatus } from "./types";

export type CreateBackendStatusTaskOptions = {
  /** 1 行の書き手(既定 console.info。test が差し替える) */
  write?: (line: string) => void;
};

/** 起動時の処理の項目の形(@/lib/startup の StartupTask と同じ) */
export type BackendStatusTask = { name: string; runtime: "nodejs"; run: () => void };

/**
 * 口 1 つの起動時の知らせの項目を作る。run は 1 行の JSON を書く:
 * { level: "info" | "warn", scope: "backends", port, selected, configured, missing? }(missing は env・設定の名前だけ)。
 * none を選んだ口は info(使わない)、足りない名前があれば warn、isConfigured が投げれば warn に誤りの名前だけ
 */
export function createBackendStatusTask(status: BackendStatus, options: CreateBackendStatusTaskOptions = {}): BackendStatusTask {
  const { port, selected } = status;
  const write = options.write ?? ((line: string) => console.info(line));
  const emit = (fields: Record<string, unknown>) => {
    try {
      write(JSON.stringify({ scope: "backends", port, selected, ...fields }));
    } catch {
      // 書き手の失敗は飲む(起動を止めない)
    }
  };
  return {
    name: `backends.${port}`,
    runtime: "nodejs",
    run() {
      if (selected === NONE_IMPLEMENTATION) {
        emit({ level: "info", configured: false, none: true });
        return;
      }
      try {
        const result = status.isConfigured();
        if (result.configured) emit({ level: "info", configured: true });
        else emit({ level: "warn", configured: false, missing: [...result.missing] });
      } catch (error) {
        emit({ level: "warn", configured: false, error: error instanceof Error ? error.name : "unknown" });
      }
    },
  };
}
