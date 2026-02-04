// src/lib/spamGuard/whitelist.ts

/**
 * 信頼ドメインリスト（国内のみ）
 * これらのドメインは無条件で通過させる
 */
export const TRUSTED_DOMAINS = new Set([
  // フリーメール
  "gmail.com",
  "yahoo.co.jp",
  "ymail.ne.jp",
  "outlook.jp",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.jp",
  "live.jp",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",

  // 携帯キャリア
  "docomo.ne.jp",
  "au.com",
  "ezweb.ne.jp",
  "softbank.ne.jp",
  "i.softbank.jp",
  "vodafone.ne.jp",
  "disney.ne.jp",
  "ymobile.ne.jp",
  "uqmobile.jp",
  "rakuten.jp",
  "rakumail.jp",

  // 大手ISP
  "nifty.com",
  "nifty.ne.jp",
  "biglobe.ne.jp",
  "biglobe.jp",
  "ocn.ne.jp",
  "so-net.ne.jp",
  "plala.or.jp",
  "dion.ne.jp",
  "asahi-net.or.jp",
  "jcom.home.ne.jp",
  "jcom.zaq.ne.jp",
  "zaq.ne.jp",
  "eonet.ne.jp",
  "infoweb.ne.jp",
  "sannet.ne.jp",
  "ybb.ne.jp",
  "wakwak.com",
  "excite.co.jp",
  "goo.jp",
]);

/**
 * 許可TLDリスト
 * これらのTLDのみ後続のチェックに進む
 * US/UK等の国別TLDは含めない（国内限定）
 */
export const ALLOWED_TLDS = new Set([
  // 汎用TLD
  "com",
  "net",
  "org",
  "biz",
  "info",
  "tokyo",
  "shop",

  // 日本のTLD
  "jp",
]);

