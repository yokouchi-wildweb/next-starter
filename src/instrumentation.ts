// src/instrumentation.ts
// Next の instrumentation の入口(上流の版。fork は書き換えず、送り先を src/wiring/serverErrors/reporters/ に足す)
// サーバーの失敗を既定の 1 行に必ず残し、項目へ配る: src/wiring/serverErrors/README.md
import { serverErrorReport } from "@/wiring/serverErrors";

export const register = serverErrorReport.register;
export const onRequestError = serverErrorReport.onRequestError;
