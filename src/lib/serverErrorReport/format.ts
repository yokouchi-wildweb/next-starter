// src/lib/serverErrorReport/format.ts
// 既定の記録の 1 行を作る。throw しない(循環・BigInt・getter の throw でも 1 行を返す)
import type { RequestErrorContext, ServerErrorScope } from "./types";

export type ServerErrorLine = {
  level: "error";
  scope: ServerErrorScope;
  path: string;
  method: string;
  routePath?: string;
  routeType?: RequestErrorContext["routeType"];
  renderSource?: RequestErrorContext["renderSource"];
  digest?: string;
  requestId?: string;
  name?: string;
  error: { name: string; message: string; stack?: string };
};

/** URL の道からクエリと断片を外す(値に個人の情報が入りうるため) */
export function stripQuery(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "[unprintable]";
  }
}

/** 失敗の値を { name, message, stack } にする(Error 以外も受ける) */
export function describeError(error: unknown): ServerErrorLine["error"] & { digest?: string } {
  try {
    if (error instanceof Error) {
      const digest = (error as { digest?: unknown }).digest;
      return {
        name: safeString(error.name),
        message: safeString(error.message),
        ...(typeof error.stack === "string" ? { stack: error.stack } : {}),
        ...(typeof digest === "string" ? { digest } : {}),
      };
    }
    return { name: "NonError", message: safeString(error) };
  } catch {
    return { name: "NonError", message: "[unprintable]" };
  }
}

/** 循環・BigInt でも throw しない JSON 1 行 */
export function toJsonLine(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, v: unknown) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[circular]";
        seen.add(v);
      }
      return v;
    });
  } catch {
    return JSON.stringify({ level: "error", scope: "serverErrorReport", reason: "unserializable" });
  }
}
