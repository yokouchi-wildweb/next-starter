// src/features/core/purchaseRequest/services/client/sdkLaunchers/paidy.ts
//
// Paidy 用クライアント SDK ローダー。
//
// paidy.js を動的に読み込み、Paidy.configure → paidyHandler.launch を Promise でラップして
// SdkLaunchOutcome を返す。サーバー側 paidyProvider が createSession で返した
// LaunchClientSdk.config がそのまま config 引数に渡される（publicKey, amount, currency,
// purchaseRequestId, buyerEmail, buyerPhoneNumber 等）。
//
// 起動側 (clientSdkHandler) は Outcome を受けて、authorized であれば確定 API を叩く。

"use client";

import { businessConfig } from "@/config/business.config";
import type { SdkLauncher, SdkLaunchOutcome } from "./types";

/**
 * paidy.js のスクリプト URL（公式ドキュメント記載）
 */
const PAIDY_SCRIPT_URL = "https://apps.paidy.com/";

/**
 * Paidy 決済オブジェクトの status 値（paidy.js が closed コールバックに渡す）
 *
 * paidy.js のソース (apps.paidy.com/) では D={AUTHORIZED:"authorized",...} となっており、
 * 実際にコールバックで渡される値は全て **小文字**。公式ドキュメントの大文字表記は定数キー名。
 */
const PAIDY_STATUS = {
  AUTHORIZED: "authorized",
  REJECTED: "rejected",
  CLOSED: "closed",
} as const;

/**
 * paidy.js の closed コールバックに渡されるオブジェクト型
 * （実際のフィールドのみ抜粋）
 */
type PaidyClosedCallback = {
  id?: string; // "pay_..." 形式の payment_id
  amount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
};

/**
 * window.Paidy のグローバル定義（paidy.js が読み込まれた後にアクセス可能）
 */
type PaidyGlobal = {
  configure(config: {
    api_key: string;
    logo_url?: string;
    closed?: (callback: PaidyClosedCallback) => void;
    metadata?: Record<string, string>;
  }): {
    launch(payload: PaidyLaunchPayload): void;
  };
};

/**
 * paidyHandler.launch に渡す payload 型（必須フィールドのみ）
 *
 * order は実質必須。未指定だと Paidy が "request_content.malformed / error.decoding / field: order"
 * を返して 400 にする。items は最低 1 件、quantity + unit_price が必須。
 */
type PaidyLaunchPayload = {
  amount: number;
  currency: string;
  store_name: string;
  buyer: {
    name1: string;
    email?: string;
    phone?: string;
  };
  order: {
    items: Array<{ id?: string; quantity: number; title?: string; unit_price: number }>;
  };
};

declare global {
  interface Window {
    Paidy?: PaidyGlobal;
  }
}

/**
 * 読み込み済みフラグ（複数回 load() を呼んでも 1 回だけ script 追加）
 */
let scriptLoaded: Promise<void> | null = null;

function loadPaidyScript(): Promise<void> {
  if (scriptLoaded) return scriptLoaded;

  scriptLoaded = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("[paidy sdk] window が undefined です（SSR 環境では load できません）"));
      return;
    }
    if (window.Paidy) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = PAIDY_SCRIPT_URL;
    script.charset = "utf-8";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("[paidy sdk] paidy.js の読み込みに失敗しました"));
    document.head.appendChild(script);
  });

  return scriptLoaded;
}

/**
 * Paidy config からの値取り出し（型ガード）。
 * サーバー側 paidyProvider が必ずセットするフィールドだが、防御的に検証する。
 */
function readConfig(config: Record<string, unknown>): {
  publicKey: string;
  amount: number;
  currency: string;
  itemTitle: string;
  buyerName: string;
  purchaseRequestId?: string;
  buyerEmail?: string;
  buyerPhoneNumber?: string;
} {
  const publicKey = typeof config.publicKey === "string" ? config.publicKey : "";
  const amount = typeof config.amount === "number" ? config.amount : NaN;
  const currency = typeof config.currency === "string" ? config.currency : "JPY";
  const itemTitle =
    typeof config.itemTitle === "string" && config.itemTitle ? config.itemTitle : "購入";
  // buyerName は Paidy の nonempty バリデーション対象。サーバー側で必ずフォールバック値を入れる
  // 前提だが、防御的に空ならローカルでも代替する。
  const rawBuyerName =
    typeof config.buyerName === "string" ? config.buyerName.trim() : "";
  const buyerName = rawBuyerName || "購入者";
  const purchaseRequestId =
    typeof config.purchaseRequestId === "string" ? config.purchaseRequestId : undefined;
  const buyerEmail =
    typeof config.buyerEmail === "string" ? config.buyerEmail : undefined;
  const buyerPhoneNumber =
    typeof config.buyerPhoneNumber === "string" ? config.buyerPhoneNumber : undefined;

  if (!publicKey) throw new Error("[paidy sdk] config.publicKey が未指定です");
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("[paidy sdk] config.amount が不正です");

  return {
    publicKey,
    amount,
    currency,
    itemTitle,
    buyerName,
    purchaseRequestId,
    buyerEmail,
    buyerPhoneNumber,
  };
}

export const paidySdkLauncher: SdkLauncher = {
  async load(): Promise<void> {
    await loadPaidyScript();
  },

  async launch(config: Record<string, unknown>): Promise<SdkLaunchOutcome> {
    if (!window.Paidy) {
      throw new Error("[paidy sdk] window.Paidy が未定義です（load() を先に呼んでください）");
    }

    const {
      publicKey,
      amount,
      currency,
      itemTitle,
      buyerName,
      purchaseRequestId,
      buyerEmail,
      buyerPhoneNumber,
    } = readConfig(config);

    return new Promise<SdkLaunchOutcome>((resolve) => {
      const handler = window.Paidy!.configure({
        api_key: publicKey,
        closed: (callback: PaidyClosedCallback) => {
          const id = callback.id;
          const status = callback.status;

          if (id && status === PAIDY_STATUS.AUTHORIZED) {
            resolve({ status: "authorized", providerPaymentId: id, rawResult: callback });
            return;
          }
          if (status === PAIDY_STATUS.REJECTED) {
            resolve({
              status: "rejected",
              providerPaymentId: id,
              reason: "Paidy が決済を拒否しました",
              rawResult: callback,
            });
            return;
          }
          // CLOSED or id 不在 or 不明 → ユーザーによる中断扱い
          resolve({ status: "closed", rawResult: callback });
        },
      });

      const payload: PaidyLaunchPayload = {
        amount,
        currency,
        store_name: businessConfig.serviceName,
        buyer: {
          // name1 は Paidy 必須 + nonempty バリデーション対象。サーバー側で
          // userService.get から取得した名前 + フォールバック値が config 経由で渡る。
          name1: buyerName,
          email: buyerEmail,
          phone: buyerPhoneNumber,
        },
        // Paidy 仕様で order.items は必須。amount = quantity * unit_price の整合性が必要。
        // wallet_topup 等の単一商品では 1 アイテム化し、unit_price に amount をそのまま入れる。
        order: {
          items: [
            {
              id: purchaseRequestId,
              quantity: 1,
              title: itemTitle,
              unit_price: amount,
            },
          ],
        },
      };

      handler.launch(payload);
    });
  },
};
