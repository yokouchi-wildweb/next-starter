// src/features/core/purchaseRequest/services/client/sdkLaunchers/paypal.ts
//
// PayPal 用クライアント SDK ローダー（PayPal JS SDK / Smart Payment Buttons）。
//
// Paidy は SDK 内部でモーダルを自動起動できたが、PayPal は「ボタンを描画して
// ユーザーがクリック」が必須（ポップアップブロッカー + SDK 仕様）。そのため
// launch() で軽量なオーバーレイを生成し、その中に PayPal ボタンを render する。
// ユーザーが PayPal ボタンを押す → PayPal のポップアップで承認 → onApprove で
// order_id を受け取り SdkLaunchOutcome を resolve する。
//
// SDK スクリプト URL は client-id / currency をクエリに含むため、config を受け取れる
// launch() 側で読み込む（load() は契約上の no-op）。client-id が sandbox のものなら
// 自動的に sandbox 環境で動作する。
//
// サーバー側 paypalProvider.createSession が返した LaunchClientSdk.config
// （clientId, env, orderId, amount, currency, purchaseRequestId）が config として渡る。

"use client";

import type { SdkLauncher, SdkLaunchOutcome } from "./types";

/**
 * PayPal JS SDK のベース URL。client-id / currency / intent をクエリで付与する。
 */
const PAYPAL_SDK_BASE_URL = "https://www.paypal.com/sdk/js";

/**
 * PayPal Buttons の最小型定義（使用フィールドのみ）
 */
type PayPalButtonsActions = {
  createOrder?: () => string | Promise<string>;
  onApprove: (data: { orderID: string }) => void | Promise<void>;
  onCancel?: (data: { orderID?: string }) => void;
  onError?: (err: unknown) => void;
  style?: Record<string, unknown>;
};

type PayPalButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close?: () => void;
};

type PayPalGlobal = {
  Buttons: (actions: PayPalButtonsActions) => PayPalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalGlobal;
  }
}

/**
 * client-id ごとの読み込み済み Promise（同一 client-id で複数回 load しても 1 回だけ）。
 */
const scriptLoadPromises = new Map<string, Promise<void>>();

/**
 * PayPal JS SDK を読み込む（client-id / currency 指定）。
 * 既に同一 client-id で読み込み済みなら再利用する。
 */
function loadPayPalScript(clientId: string, currency: string): Promise<void> {
  const key = `${clientId}:${currency}`;
  const cached = scriptLoadPromises.get(key);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("[paypal sdk] window が undefined です（SSR 環境では load できません）"));
      return;
    }
    if (window.paypal) {
      resolve();
      return;
    }

    const params = new URLSearchParams({
      "client-id": clientId,
      currency,
      intent: "capture",
      components: "buttons",
    });

    const script = document.createElement("script");
    script.src = `${PAYPAL_SDK_BASE_URL}?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("[paypal sdk] PayPal JS SDK の読み込みに失敗しました"));
    document.head.appendChild(script);
  });

  scriptLoadPromises.set(key, promise);
  return promise;
}

/**
 * PayPal config からの値取り出し（型ガード）。
 */
function readConfig(config: Record<string, unknown>): {
  clientId: string;
  orderId: string;
  amount: number;
  currency: string;
} {
  const clientId = typeof config.clientId === "string" ? config.clientId : "";
  const orderId = typeof config.orderId === "string" ? config.orderId : "";
  const amount = typeof config.amount === "number" ? config.amount : NaN;
  const currency = typeof config.currency === "string" ? config.currency : "JPY";

  if (!clientId) throw new Error("[paypal sdk] config.clientId が未指定です");
  if (!orderId) throw new Error("[paypal sdk] config.orderId が未指定です");

  return { clientId, orderId, amount, currency };
}

/**
 * 金額表示（JPY を「¥1,000」形式に整形）。失敗時は素の数値文字列にフォールバック。
 */
function formatAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

/**
 * PayPal ボタンを描画するオーバーレイ DOM を生成する。
 *
 * 既存の React 製 Overlays/* は JSX コンポーネントで、この命令的 launcher からは使えないため、
 * Paidy launcher 同様に最小限の DOM をインライン style で組み立てる（Tailwind の purge 影響を受けない）。
 *
 * @returns backdrop（ルート要素）/ buttonsHost（ボタン描画先）/ onCloseRequest（閉じる導線の登録）
 */
function buildOverlay(params: {
  amountLabel: string;
  onCloseRequest: () => void;
}): { backdrop: HTMLDivElement; buttonsHost: HTMLDivElement; cleanup: () => void } {
  const backdrop = document.createElement("div");
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483000",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:16px",
    "background:rgba(0,0,0,0.5)",
  ].join(";");

  const modal = document.createElement("div");
  modal.style.cssText = [
    "position:relative",
    "width:100%",
    "max-width:420px",
    "max-height:90vh",
    "overflow:auto",
    "background:#ffffff",
    "border-radius:16px",
    "padding:24px",
    "box-shadow:0 20px 60px rgba(0,0,0,0.3)",
    "font-family:system-ui,-apple-system,sans-serif",
  ].join(";");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "閉じる");
  closeButton.textContent = "×";
  closeButton.style.cssText = [
    "position:absolute",
    "top:12px",
    "right:12px",
    "width:32px",
    "height:32px",
    "border:none",
    "background:transparent",
    "font-size:22px",
    "line-height:1",
    "color:#6b7280",
    "cursor:pointer",
  ].join(";");

  const title = document.createElement("div");
  title.textContent = "PayPal でお支払い";
  title.style.cssText = "font-size:16px;font-weight:600;color:#111827;margin-bottom:4px";

  const amountEl = document.createElement("div");
  amountEl.textContent = params.amountLabel;
  amountEl.style.cssText = "font-size:24px;font-weight:700;color:#111827;margin-bottom:20px";

  const buttonsHost = document.createElement("div");
  buttonsHost.style.cssText = "min-height:48px";

  modal.appendChild(closeButton);
  modal.appendChild(title);
  if (params.amountLabel) modal.appendChild(amountEl);
  modal.appendChild(buttonsHost);
  backdrop.appendChild(modal);

  // 閉じる導線: × ボタン or 背景クリック
  closeButton.addEventListener("click", params.onCloseRequest);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) params.onCloseRequest();
  });

  const cleanup = () => {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  };

  document.body.appendChild(backdrop);

  return { backdrop, buttonsHost, cleanup };
}

export const paypalSdkLauncher: SdkLauncher = {
  // PayPal の SDK URL は client-id / currency をクエリに含むため、config を受け取れる
  // launch() 側で読み込む。ここでは何もしない（契約上の no-op）。
  async load(): Promise<void> {
    // no-op
  },

  async launch(config: Record<string, unknown>): Promise<SdkLaunchOutcome> {
    const { clientId, orderId, amount, currency } = readConfig(config);

    await loadPayPalScript(clientId, currency);

    if (!window.paypal) {
      throw new Error("[paypal sdk] window.paypal が未定義です（SDK 読み込み失敗）");
    }

    return new Promise<SdkLaunchOutcome>((resolve) => {
      let settled = false;
      let buttonsInstance: PayPalButtonsInstance | null = null;

      const settle = (outcome: SdkLaunchOutcome) => {
        if (settled) return;
        settled = true;
        try {
          buttonsInstance?.close?.();
        } catch {
          // close 失敗は無視（cleanup を優先）
        }
        cleanup();
        resolve(outcome);
      };

      const { buttonsHost, cleanup } = buildOverlay({
        amountLabel: formatAmount(amount, currency),
        // ユーザーがオーバーレイを閉じた = 明示的中断（closed）
        onCloseRequest: () => settle({ status: "closed", rawResult: { reason: "user_closed_overlay" } }),
      });

      buttonsInstance = window.paypal!.Buttons({
        style: { layout: "vertical", label: "paypal" },
        // 注文はサーバー側 createSession で作成済み。その order_id をそのまま返す。
        createOrder: () => orderId,
        onApprove: (data) => {
          settle({
            status: "authorized",
            providerPaymentId: data.orderID ?? orderId,
            rawResult: data,
          });
        },
        // PayPal ポップアップでユーザーがキャンセル = 中断（closed）
        onCancel: (data) => {
          settle({ status: "closed", rawResult: data });
        },
        // SDK / ネットワークエラー = 拒否（rejected: 呼び元でエラー表示）
        onError: (err) => {
          settle({
            status: "rejected",
            reason: "PayPal でエラーが発生しました",
            rawResult: err,
          });
        },
      });

      buttonsInstance.render(buttonsHost).catch((err) => {
        settle({
          status: "rejected",
          reason: "PayPal ボタンの表示に失敗しました",
          rawResult: err,
        });
      });
    });
  },
};
