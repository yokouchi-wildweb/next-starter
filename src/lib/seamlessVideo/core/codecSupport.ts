// src/lib/seamlessVideo/core/codecSupport.ts
//
// MSE(Media Source Extensions)のサポート判定ユーティリティ。
// iPhone Safari は通常の MediaSource 非対応で、ManagedMediaSource(iOS 17.1+)でのみ動作する。
// このライブラリは両方を透過的に扱うため、利用可能な実装を一元的に解決する。

type ManagedMediaSourceCtor = typeof MediaSource;

type MseGlobals = {
  MediaSource?: typeof MediaSource;
  ManagedMediaSource?: ManagedMediaSourceCtor;
};

/**
 * この環境で利用可能な MediaSource 実装のコンストラクタを返す。
 * ManagedMediaSource を優先する(iPhone 対応)。SSR や未対応環境では null。
 */
export function getMediaSourceCtor(): ManagedMediaSourceCtor | null {
  if (typeof window === "undefined") return null;
  const g = window as unknown as MseGlobals;
  return g.ManagedMediaSource ?? g.MediaSource ?? null;
}

/** 解決された実装が ManagedMediaSource(iPhone 系)かどうか。 */
export function isManagedMediaSource(ctor: ManagedMediaSourceCtor | null): boolean {
  if (typeof window === "undefined" || !ctor) return false;
  const g = window as unknown as MseGlobals;
  return !!g.ManagedMediaSource && ctor === g.ManagedMediaSource;
}

/** この環境で MSE による連結再生が利用可能か。 */
export function isMseSupported(): boolean {
  return getMediaSourceCtor() !== null;
}

/**
 * 指定 MIME(コーデック付き)がこの環境で再生可能か。
 * 例: isTypeSupported('video/mp4; codecs="avc1.640028"')
 */
export function isTypeSupported(mimeType: string): boolean {
  const ctor = getMediaSourceCtor() as (ManagedMediaSourceCtor & { isTypeSupported?: (t: string) => boolean }) | null;
  if (!ctor || typeof ctor.isTypeSupported !== "function") return false;
  return ctor.isTypeSupported(mimeType);
}
