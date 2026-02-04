// src/lib/spamGuard/debounce.ts

const DEBOUNCE_API_URL = "https://disposable.debounce.io";
const TIMEOUT_MS = 3000;

type DebounceResponse = {
  disposable: "true" | "false";
};

/**
 * DeBounce API を使用して使い捨てメールかどうかをチェックする
 * API がダウンしている場合やタイムアウトした場合は false を返す（通過させる）
 */
export async function checkDebounce(email: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${DEBOUNCE_API_URL}/?email=${encodeURIComponent(email)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // API エラー時は通過させる
      return false;
    }

    const data: DebounceResponse = await response.json();
    return data.disposable === "true";
  } catch {
    // タイムアウト、ネットワークエラー等は通過させる
    return false;
  }
}
