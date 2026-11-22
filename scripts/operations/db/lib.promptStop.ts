// scripts/operations/db/lib.promptStop.ts
//
// drizzle-kit の「作成か改名か」の問いの見張り(pnpm db:push:check と pnpm db:push が pushSchema の前に呼ぶ)。
// stdin が TTY でないとき、標準出力を見張り、問いが出た時点で説明(lib.pendingPrompt.ts)を出して exit 1。
// 問いは答えを待つだけで終わらないため、ここで止める(答えは選ばない)。TTY があれば今まで通り問いに答えられる。

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findNoticeAnswers, formatPendingPrompt, parsePendingPrompt, type PromptStopMode } from "./lib.pendingPrompt";

/** 本リポジトリの .notices/*.md(改名の答えを名指す行を探す) */
const readNotices = (): { id: string; text: string }[] => {
  const dir = join(process.cwd(), ".notices");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => ({ id: f.replace(/\.md$/, ""), text: readFileSync(join(dir, f), "utf8") }));
  } catch {
    return [];
  }
};

/** TTY のない実行で drizzle-kit の問いが出たら、説明して exit 1(mode = 止まった命令の言い方) */
export const stopOnPromptWithoutTty = (mode: PromptStopMode): void => {
  if (process.stdin.isTTY) return;
  const write = process.stdout.write.bind(process.stdout);
  let buffer = "";
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    const prompt = parsePendingPrompt(buffer);
    if (!prompt) {
      buffer = buffer.slice(-4096);
      return (write as (...args: unknown[]) => boolean)(chunk, ...rest);
    }
    process.stdout.write = write;
    console.log(formatPendingPrompt(prompt, findNoticeAnswers(prompt, readNotices()), mode));
    process.exit(1);
  }) as typeof process.stdout.write;
};
