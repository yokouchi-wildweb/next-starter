// src/lib/request/getClientIp.ts

import { headers } from "next/headers";

type HeaderReader = { get(name: string): string | null };

/**
 * リクエストヘッダーからクライアントのIPアドレスを取り出す（純粋関数版）。
 * Route Handler の req.headers など、headers() 以外のヘッダーを読むときに使う。
 * Vercel、Cloudflare、一般的なプロキシに対応。
 *
 * 信頼の前提: x-forwarded-for はプロキシが付け直す場合だけ信頼できる。Vercel は上書きするが、
 * 自前のリバースプロキシの後ろでは、そのプロキシが受け取った値を消して付け直す設定にすること。
 *
 * @returns IPアドレス。取得できない場合はnull。
 */
export function readClientIp(headerList: HeaderReader): string | null {
  // Vercel固有（最優先）
  const vercelForwardedFor = headerList.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }

  // Cloudflare固有
  const cfConnectingIp = headerList.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // 一般的なプロキシ（x-forwarded-for）
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    // カンマ区切りの最初のIPが元クライアント
    return forwardedFor.split(",")[0].trim();
  }

  // その他のプロキシ
  const realIp = headerList.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return null;
}

/**
 * クライアントのIPアドレスを取得する（Server Component / Route Handler の headers() から）。
 *
 * @returns IPアドレス。取得できない場合はnull。
 */
export async function getClientIp(): Promise<string | null> {
  return readClientIp(await headers());
}
