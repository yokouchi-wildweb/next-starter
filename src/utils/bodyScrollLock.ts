// src/utils/bodyScrollLock.ts
//
// body のスクロールロックを参照カウントで管理する純粋ユーティリティ。
// useDisableScroll の内部実装であり、コンポーネントから直接呼ぶ想定ではない。
//
// 設計:
// - 元の overflow は computed 値ではなく「インライン値」(body.style.overflow) を退避する。
//   Radix Dialog (react-remove-scroll) は <style> + data 属性で body をロックするため、
//   computed 値を退避すると "hidden" を元の値と誤認し、解除後も body がロックされ続ける。
// - カウンタと退避値はモジュール変数ではなく body の data 属性に保持する。
//   開発時の Fast Refresh でモジュールが再評価されても状態が失われず、DevTools で目視できる。
// - 最初の取得で退避 + hidden 設定、最後の解放で復元。解放順に依存しない。

const LOCK_COUNT_ATTR = "data-disable-scroll-count";
const ORIGINAL_OVERFLOW_ATTR = "data-disable-scroll-original-overflow";

const readLockCount = (body: HTMLElement): number => {
  const raw = body.getAttribute(LOCK_COUNT_ATTR);
  if (raw === null) return 0;
  const count = Number.parseInt(raw, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

/**
 * body のスクロールロックを1つ取得する。
 * カウントが 0 → 1 になる最初の取得時のみ、インライン overflow を退避して hidden を設定する。
 */
export const acquireBodyScrollLock = (body: HTMLElement): void => {
  const count = readLockCount(body);
  if (count === 0) {
    body.setAttribute(ORIGINAL_OVERFLOW_ATTR, body.style.overflow);
    body.style.overflow = "hidden";
  }
  body.setAttribute(LOCK_COUNT_ATTR, String(count + 1));
};

/**
 * body のスクロールロックを1つ解放する。
 * カウントが 1 → 0 になる最後の解放時のみ、退避していたインライン overflow を復元する。
 * 退避値が空ならプロパティ自体を削除し、スタイルシート側の値に戻す。
 */
export const releaseBodyScrollLock = (body: HTMLElement): void => {
  const count = readLockCount(body);
  if (count === 0) return;

  if (count > 1) {
    body.setAttribute(LOCK_COUNT_ATTR, String(count - 1));
    return;
  }

  const original = body.getAttribute(ORIGINAL_OVERFLOW_ATTR) ?? "";
  if (original === "") {
    body.style.removeProperty("overflow");
  } else {
    body.style.overflow = original;
  }
  body.removeAttribute(LOCK_COUNT_ATTR);
  body.removeAttribute(ORIGINAL_OVERFLOW_ATTR);
};

/** 現在 body がこのユーティリティによってロックされているか */
export const isBodyScrollLocked = (body: HTMLElement): boolean =>
  readLockCount(body) > 0;
