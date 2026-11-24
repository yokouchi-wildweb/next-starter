// src/domains/core/outbox/services/server/outbox.ts
// 送り箱の芯(D23): 積む(enqueueOutbox)・押す(kickOutbox)・まとめ(withOutbox)と、1 行を処理する唯一の入口(processOutboxRow)。
// - 積むのは呼び手の取引の中(tx 必須)。kind は処理の項目の一覧(門で絞らない)に在ること、payload は項目の schema と版の欄 v
// - 押すのはコミットの後に Next の after() で 1 回。投げない・待たない・保証しない(保証は定期処理)
// - 1 行の処理: 取る → 門で絞った処理の項目を呼ぶ → 届けた / 失敗(指数の間隔で次の時刻、上限で隔離、消さない)
//   処理が無い(閉じたドメインの kind)行は数えずに戻す、未設定の基底(BackendNotConfiguredError)は数えずに次の時刻だけ延ばす(どちらも保留、D22・D23)
// - 定期処理・監視・再処理は ./dispatch.ts(取った行はここの processClaimedRow を通る)
// 依存は createOutbox に渡す(単体テストは偽物で回す)。本物の束は ./index.ts

import { isBackendNotConfiguredError } from "@/lib/errors";

import type { OutboxJobRow } from "../../entities/model";
import type { OutboxBackoff, OutboxHandler, OutboxKind } from "../../points";
import type { OutboxStore } from "./store";

export type OutboxEnqueueInput = {
  /** 処理の項目の kind("<地区>.<動作>") */
  kind: OutboxKind;
  /** JSON、版の欄 v(数)を持つ、秘密を入れない */
  payload: { v: number } & Record<string, unknown>;
  /** 同じ kind で同じ鍵なら積まない */
  idempotencyKey: string;
  /** この時より前は届けない */
  notBefore?: Date;
};

export type OutboxEnqueueResult = { id: string; duplicate: boolean };

/**
 * 1 行の処理の結果: done = 届けた / failed = 試行を 1 足して次の時刻へ / quarantined = 上限で隔離 /
 * held = 保留(閉じたドメインの kind・未設定の基底。試行を数えない)/ skipped = 取れない(時が来ていない・他が取った・済み)
 */
export type OutboxProcessResult = "done" | "failed" | "quarantined" | "held" | "skipped";

/** 再試行の既定(処理の項目が書かない時。値は ../../config.ts の retry) */
export type OutboxRetryDefaults = { maxAttempts: number; backoff: Required<OutboxBackoff> };

export type OutboxDeps<Tx> = {
  store: OutboxStore<Tx>;
  /** 1 つの取引で fn を回し、コミットの後に値を返す */
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
  /** 処理の項目の全部(門で絞らない。積む時の kind と schema の確かめ) */
  allHandlers: () => Promise<readonly OutboxHandler[]>;
  /** 門で閉じたドメインの項目を外した一覧(届ける時) */
  openHandlers: () => Promise<readonly OutboxHandler[]>;
  /** コミットの後に回す(Next の after()) */
  after: (task: () => Promise<void>) => void;
  /** 再試行の既定 */
  retry: OutboxRetryDefaults;
  now?: () => Date;
  /** 1 行の記録の書き手(既定 console.error) */
  log?: (line: string) => void;
};

const findHandler = (handlers: readonly OutboxHandler[], kind: OutboxKind) => handlers.find((h) => h.kind === kind);

const ERROR_MAX = 500;
const errorText = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}`.slice(0, ERROR_MAX) : "unknown");

/** attempt 回目の試行が失敗した後、次の試行までの秒(baseSeconds × 2^(attempt − 1)、maxSeconds で頭打ち) */
export function outboxBackoffSeconds(attempt: number, backoff: OutboxBackoff | undefined, defaults: Required<OutboxBackoff>): number {
  const base = backoff?.baseSeconds ?? defaults.baseSeconds;
  const max = backoff?.maxSeconds ?? defaults.maxSeconds;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), max);
}

export function createOutbox<Tx>(deps: OutboxDeps<Tx>) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((line: string) => console.error(line));

  async function enqueueOutbox(tx: Tx, input: OutboxEnqueueInput): Promise<OutboxEnqueueResult> {
    if (!tx) throw new Error("enqueueOutbox: tx が要る(業務の更新と同じ取引で積む)");
    const handler = findHandler(await deps.allHandlers(), input.kind);
    if (!handler) throw new Error(`enqueueOutbox: kind ${input.kind} の処理の項目が無い(<地区>/plugs/outboxHandlers/<名前>.ts)`);
    if (typeof input.payload?.v !== "number") throw new Error(`enqueueOutbox: ${input.kind} の payload に版の欄 v(数)が無い`);
    const parsed = handler.schema.safeParse(input.payload);
    if (!parsed.success) throw new Error(`enqueueOutbox: ${input.kind} の payload が schema に合わない`);
    return deps.store.insert(tx, {
      kind: input.kind,
      payload: parsed.data as Record<string, unknown>,
      idempotencyKey: input.idempotencyKey,
      ...(input.notBefore ? { notBefore: input.notBefore } : {}),
    });
  }

  /** 取った(running の)行を 1 つ処理する。handlers = 門で絞った処理の項目(定期処理は 1 回の実行で 1 度だけ読む) */
  async function processClaimedRow(row: OutboxJobRow, handlers: readonly OutboxHandler[]): Promise<OutboxProcessResult> {
    const handler = findHandler(handlers, row.kind);
    if (!handler) {
      await deps.store.release(row.id, now());
      return "held";
    }
    const attempt = row.attempts + 1;
    const nextAt = () => new Date(now().getTime() + outboxBackoffSeconds(attempt, handler.backoff, deps.retry.backoff) * 1000);
    try {
      const payload = handler.schema.parse(row.payload);
      await handler.handle(payload, { id: row.id, attempt });
      await deps.store.markDone(row.id, now());
      return "done";
    } catch (error) {
      if (isBackendNotConfiguredError(error)) {
        await deps.store.hold(row.id, errorText(error), nextAt(), now());
        return "held";
      }
      if (attempt >= (handler.maxAttempts ?? deps.retry.maxAttempts)) {
        await deps.store.markQuarantined(row.id, errorText(error), now());
        return "quarantined";
      }
      await deps.store.markFailed(row.id, errorText(error), nextAt(), now());
      return "failed";
    }
  }

  /** 1 行を処理する唯一の入口(押す・定期処理の両方がここか processClaimedRow を通る) */
  async function processOutboxRow(id: string): Promise<OutboxProcessResult> {
    const row = await deps.store.claim(id, now());
    if (!row) return "skipped";
    return processClaimedRow(row, await deps.openHandlers());
  }

  /** 渡した行だけをコミットの後に 1 回動かす。投げない・待たない・保証しない */
  function kickOutbox(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const run = async () => {
      for (const id of ids) {
        try {
          await processOutboxRow(id);
        } catch (error) {
          log(JSON.stringify({ level: "warn", scope: "outbox", phase: "kick", id, error: error instanceof Error ? error.name : "unknown" }));
        }
      }
    };
    try {
      deps.after(run);
    } catch (error) {
      // 要求の外(after が使えない)など: 定期処理が届ける
      log(JSON.stringify({ level: "warn", scope: "outbox", phase: "kick", error: error instanceof Error ? error.name : "unknown" }));
    }
  }

  /** 積む → コミット → 押す。fn が投げれば巻き戻り、押さない */
  async function withOutbox<T>(fn: (scope: { tx: Tx; enqueue: (input: OutboxEnqueueInput) => Promise<OutboxEnqueueResult> }) => Promise<T>): Promise<T> {
    const fresh: string[] = [];
    const value = await deps.transaction(async (tx) =>
      fn({
        tx,
        enqueue: async (input) => {
          const result = await enqueueOutbox(tx, input);
          if (!result.duplicate) fresh.push(result.id);
          return result;
        },
      }),
    );
    kickOutbox(fresh);
    return value;
  }

  return { enqueueOutbox, kickOutbox, withOutbox, processOutboxRow, processClaimedRow };
}
