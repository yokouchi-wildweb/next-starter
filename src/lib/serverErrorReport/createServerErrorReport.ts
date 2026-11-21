// src/lib/serverErrorReport/createServerErrorReport.ts
// 受け口の芯: 既定の 1 行を必ず先に書き、その後に項目(送り先)へ互いに独立に配る。どの関数も throw しない
import { describeError, stripQuery, toJsonLine, type ServerErrorLine } from "./format";
import type {
  RequestErrorContext,
  RequestErrorRequest,
  ServerErrorReportInput,
  ServerErrorReportOptions,
  ServerErrorReporter,
  ServerErrorReporterLoader,
} from "./types";

export type ServerErrorReport = {
  /** Next の register にそのまま渡す */
  register: () => Promise<void>;
  /** Next の onRequestError にそのまま渡す */
  onRequestError: (error: unknown, request: RequestErrorRequest, context: RequestErrorContext) => Promise<void>;
  /** 入口(route factory・cron・proxy)が自分で受け止めた失敗を同じ記録へ */
  report: (error: unknown, input: ServerErrorReportInput) => Promise<void>;
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

function runsHere(reporter: ServerErrorReporter, runtime: "nodejs" | "edge"): boolean {
  const want = reporter.runtime ?? "nodejs";
  return want === "both" || want === runtime;
}

export function createServerErrorReport(
  loaders: readonly ServerErrorReporterLoader[],
  options: ServerErrorReportOptions,
): ServerErrorReport {
  const write = (value: unknown) => {
    const line = toJsonLine(value);
    try {
      (options.write ?? console.error)(line);
    } catch {
      // 書き手の失敗は飲む(記録のための記録はしない)
    }
  };

  const fail = (reporter: string, phase: "load" | "register" | "onRequestError", reason: unknown) =>
    write({
      level: "error",
      scope: "serverErrorReport",
      reporter,
      phase,
      reason: reason === TIMED_OUT ? "timeout" : describeError(reason),
    });

  // 項目の読み込みは 1 回だけ(失敗した項目は以後外す)。runtime の合わない項目も外す
  let loaded: Promise<ServerErrorReporter[]> | undefined;
  const reporters = () =>
    (loaded ??= Promise.all(
      loaders.map(async (loader) => {
        try {
          const reporter = await loader.load();
          return runsHere(reporter, options.runtime) ? reporter : undefined;
        } catch (error) {
          fail(loader.name, "load", error);
          return undefined;
        }
      }),
    ).then((list) => list.filter((r): r is ServerErrorReporter => r !== undefined)));

  const deliver = async (error: unknown, request: RequestErrorRequest, context: RequestErrorContext) => {
    const list = await reporters();
    await Promise.all(
      list.map(async (reporter) => {
        if (!reporter.onRequestError) return;
        try {
          const result = await withLimit(() => reporter.onRequestError!(error, request, context), options.timeoutMs);
          if (result === TIMED_OUT) fail(reporter.name, "onRequestError", TIMED_OUT);
        } catch (reason) {
          fail(reporter.name, "onRequestError", reason);
        }
      }),
    );
  };

  const writeDefault = (error: unknown, line: Omit<ServerErrorLine, "level" | "error" | "digest">) => {
    const { digest, ...described } = describeError(error);
    write({ level: "error", ...line, ...(digest ? { digest } : {}), error: described });
  };

  return {
    async register() {
      try {
        const list = await reporters();
        await Promise.all(
          list.map(async (reporter) => {
            if (!reporter.register) return;
            try {
              const result = await withLimit(() => reporter.register!(), options.registerTimeoutMs);
              if (result === TIMED_OUT) fail(reporter.name, "register", TIMED_OUT);
            } catch (reason) {
              fail(reporter.name, "register", reason);
            }
          }),
        );
      } catch (reason) {
        fail("*", "register", reason);
      }
    },

    async onRequestError(error, request, context) {
      try {
        writeDefault(error, {
          scope: "request",
          path: stripQuery(request.path),
          method: request.method,
          routePath: context.routePath,
          routeType: context.routeType,
          ...(context.renderSource ? { renderSource: context.renderSource } : {}),
        });
        await deliver(error, request, context);
      } catch (reason) {
        fail("*", "onRequestError", reason);
      }
    },

    async report(error, input) {
      try {
        const path = stripQuery(input.path);
        const routeType = input.routeType ?? (input.scope === "proxy" ? "proxy" : "route");
        writeDefault(error, {
          scope: input.scope,
          path,
          method: input.method,
          ...(input.routePath ? { routePath: input.routePath } : {}),
          routeType,
          ...(input.requestId ? { requestId: input.requestId } : {}),
          ...(input.name ? { name: input.name } : {}),
        });
        await deliver(
          error,
          { path, method: input.method, headers: input.headers ?? {} },
          { routerKind: "App Router", routePath: input.routePath ?? path, routeType, revalidateReason: undefined },
        );
      } catch (reason) {
        fail("*", "onRequestError", reason);
      }
    },
  };
}
