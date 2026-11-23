// src/lib/cacheTags/readThrough.ts — 包んだ共有の読みが置き場の失敗で投げた時に、DB を直に読んで返す(server だけ、入口 ./server)

import { isDomainError } from "@/lib/errors";

/**
 * 包んだ読み(cached = "use cache: remote" の関数)を呼び、置き場(cacheHandlers の remote)が止まって投げた時は
 * direct(base を直に読む)を返す。Next は handler の get の失敗を包まず描画の失敗にする(cacheHandlers の Error Handling)ので、
 * 生成した読みはこれで包む(置き場が止まっても DB で動く、D53 K6)。
 * - DomainError(見つからない等、読みそのものの答え)はそのまま投げる(DB を 2 度読まない)
 * - 落ちた時は記録の 1 行(console.error の JSON、名前と message だけ)
 */
export async function readThrough<T>(name: string, cached: () => Promise<T>, direct: () => Promise<T>): Promise<T> {
  try {
    return await cached();
  } catch (error) {
    if (isDomainError(error)) throw error;
    console.error(
      JSON.stringify({
        event: "cache read fell back to the database",
        lib: "cacheTags",
        read: name,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return direct();
  }
}
