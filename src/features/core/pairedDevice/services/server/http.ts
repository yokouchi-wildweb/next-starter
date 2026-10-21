// src/features/core/pairedDevice/services/server/http.ts
//
// PairedDeviceError を { message, reason } の JSON に変換する（画面は reason で表示を切り替える）。

import { NextResponse } from "next/server";

import { isPairedDeviceError } from "./kinds";

/** PairedDeviceError なら理由付きのレスポンスを返す。それ以外は null（呼び出し側で再 throw する） */
export function pairedDeviceErrorResponse(error: unknown): NextResponse | null {
  if (!isPairedDeviceError(error)) return null;
  return NextResponse.json({ message: error.message, reason: error.reason }, { status: error.status });
}

/**
 * ハンドラを包み、PairedDeviceError を理由付きのレスポンスに変換する。
 * それ以外のエラーは routeFactory の既定の変換（{ message }）に任せる。
 */
export async function withPairedDeviceErrors<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (error) {
    const response = pairedDeviceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
