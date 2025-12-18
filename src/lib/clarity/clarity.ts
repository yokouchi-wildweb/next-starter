// src/lib/clarity/clarity.ts

let initialized = false;

/**
 * Microsoft Clarity が有効かどうかを判定
 */
export function isClarityEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID;
}

/**
 * Microsoft Clarity を初期化
 * - SSR 環境では何もしない
 * - NEXT_PUBLIC_MICROSOFT_CLARITY_ID が未設定の場合は何もしない
 * - 複数回呼び出しても一度だけ初期化
 */
export function initClarity(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;

  const clarityId = process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID;
  if (!clarityId) return;

  // Microsoft Clarity のスクリプトを動的に注入
  const win = window as typeof window & {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  };

  win.clarity =
    win.clarity ||
    function (...args: unknown[]) {
      (win.clarity!.q = win.clarity!.q || []).push(args);
    };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${clarityId}`;
  document.head.appendChild(script);

  initialized = true;
}
