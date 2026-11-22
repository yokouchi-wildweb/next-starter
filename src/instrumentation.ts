// src/instrumentation.ts
// Next の instrumentation の入口(上流の版。fork は書き換えない)
// - register: サーバーの起動時の処理(@/lib/startup、結び目は生成物 src/wiring/startup.ts)。fork は自分のドメインか lib の plugs/startupTasks/ に足す
// - onRequestError: サーバーの失敗を既定の 1 行に必ず残し、送り先へ配る(@/lib/serverErrorReport、結び目は生成物 src/wiring/serverErrorReport.ts)。
//   fork は送り先を plugs/serverErrorReporters/ に足す
import { serverErrorReport } from "@/wiring/serverErrorReport";
import { startup } from "@/wiring/startup";

export const register = startup.register;
export const onRequestError = serverErrorReport.onRequestError;
