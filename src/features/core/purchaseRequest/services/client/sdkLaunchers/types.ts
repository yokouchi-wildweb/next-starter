// src/features/core/purchaseRequest/services/client/sdkLaunchers/types.ts
//
// JS SDK 型決済プロバイダのクライアント起動レイヤ用の共通型。
// LaunchInstruction.type === "client_sdk" の handler がここで定義される
// SdkLauncher を sdkName 経由で取得して使う。

/**
 * SDK 起動の結果。
 *
 * - "authorized": 与信成功 / 決済成功（providerPaymentId は必ずある）
 * - "rejected":   プロバイダが決済を拒否（providerPaymentId はあれば付与）
 * - "closed":     ユーザーがモーダルを閉じた（明示的中断、購入は不成立）
 */
export type SdkLaunchOutcome =
  | { status: "authorized"; providerPaymentId: string; rawResult: unknown }
  | { status: "rejected"; providerPaymentId?: string; reason?: string; rawResult: unknown }
  | { status: "closed"; rawResult: unknown };

/**
 * SDK ローダーの interface。
 *
 * 各 JS SDK 型プロバイダ（paidy, 将来の amazon_pay 等）が実装する。
 * 共通起動レイヤから sdkLaunchers レジストリ経由で取得され、load → launch の順で呼ばれる。
 */
export type SdkLauncher = {
  /**
   * SDK スクリプトをページに動的に読み込む。
   * 複数回呼ばれても 1 回だけ実行されるよう冪等に実装すること。
   */
  load(): Promise<void>;

  /**
   * モーダルを起動して決済を実施する。
   * config は createSession が返した LaunchClientSdk.config がそのまま渡される。
   */
  launch(config: Record<string, unknown>): Promise<SdkLaunchOutcome>;
};
