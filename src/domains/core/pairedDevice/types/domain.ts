// src/domains/core/pairedDevice/types/domain.ts
// どの表にも属さないドメイン全体の型(entities/<登録名>/ にはその表の物だけ)

/**
 * 認証済みの端末（リクエストの主体）。getSessionDevice / createDeviceRoute が返す。
 * scope は kind の scopeSchema で検証済み。
 */
export type SessionDevice<TKind extends string = string, TScope = unknown> = {
  deviceId: string;
  kind: TKind;
  label: string;
  scope: TScope;
};
