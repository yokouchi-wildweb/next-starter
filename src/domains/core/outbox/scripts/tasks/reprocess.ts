// src/domains/core/outbox/scripts/tasks/reprocess.ts
// 使い方: pnpm task outbox:reprocess -- (--kind <kind>[,...] | --id <id>[,...] | --all)
// 隔離(quarantined)の行を待ち(pending・試行 0・今すぐ)へ戻す。隔離でない行は触らないので何度流しても同じ。届けるのは次の定期処理

import type { OutboxKind } from "@/domains/outbox/points";
import { type OneShotTask, TaskNotStartedError } from "@/lib/task";

const USAGE = "使い方: pnpm task outbox:reprocess -- (--kind <kind>[,...] | --id <id>[,...] | --all)";

/** kind は "<地区>.<動作>" の形 */
const isOutboxKind = (value: string): value is OutboxKind => /^[^.\s]+\.\S+$/.test(value);

export const task: OneShotTask = {
  name: "outbox:reprocess",
  run: async () => {
    // pnpm は "--" をそのまま渡してくるため除去する
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    const readList = (name: string): string[] | undefined => {
      const index = args.indexOf(`--${name}`);
      if (index < 0) return undefined;
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new TaskNotStartedError(USAGE);
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    };
    const kindArgs = readList("kind");
    const kinds = kindArgs?.filter(isOutboxKind);
    if (kindArgs && kinds && kinds.length !== kindArgs.length) throw new TaskNotStartedError(`kind は "<地区>.<動作>" の形。${USAGE}`);
    const ids = readList("id");
    if (!kinds && !ids && !args.includes("--all")) throw new TaskNotStartedError(USAGE);
    const { reprocessQuarantinedOutbox } = await import("@/domains/core/outbox/services/server");
    return await reprocessQuarantinedOutbox({ kinds, ids });
  },
};
