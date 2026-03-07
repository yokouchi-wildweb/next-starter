// src/lib/spamGuard/hideMyEmailDetector.ts

/**
 * Apple「メールを非公開（Hide My Email）」で生成されたアドレスを検知する
 *
 * 検知パターン:
 * - ドメインが icloud.com
 * - ローカルパートが「辞書単語2-3語 + 英数字サフィックス2文字」の機械生成構造
 *
 * サフィックスの特徴:
 * - 必ず2文字（数字+英数字）
 * - Apple が一意性確保のために付与
 * - 例: 0m, 1f, 5a, 98, 16
 *
 * 検知対象の例:
 * - boleros.sawmill2j@icloud.com（単語.単語+サフィックス）
 * - pleased-latex-16@icloud.com（単語-単語-サフィックス）
 * - masseur_ban1m@icloud.com（単語_単語+サフィックス）
 * - 32.wombats_rebids@icloud.com（サフィックス.単語_単語）
 */

const HIDE_MY_EMAIL_DOMAIN = "icloud.com";

/**
 * サフィックスパターン: 数字で始まる英数字2文字
 *
 * Hide My Email のサフィックスは常に数字始まり。
 * これにより `mike.smith` のような正規アドレスとの誤検知を防ぐ。
 */
const SUFFIX_PATTERN = /^[0-9][a-z0-9]$/;

/** 単語パターン: 3文字以上の小文字英字のみ */
const WORD_PATTERN = /^[a-z]{3,}$/;

/**
 * セグメント末尾から埋め込みサフィックスを分離する
 * 例: "sawmill2j" → { word: "sawmill", suffix: "2j" }
 */
function extractTrailingSuffix(
  segment: string,
): { word: string; suffix: string } | null {
  if (segment.length < 5) return null; // 最低 word(3) + suffix(2)
  const suffix = segment.slice(-2);
  const word = segment.slice(0, -2);
  if (SUFFIX_PATTERN.test(suffix) && WORD_PATTERN.test(word)) {
    return { word, suffix };
  }
  return null;
}

/**
 * セグメント先頭から埋め込みサフィックスを分離する
 * 例: "08nadir" → { suffix: "08", word: "nadir" }
 */
function extractLeadingSuffix(
  segment: string,
): { suffix: string; word: string } | null {
  if (segment.length < 5) return null;
  const suffix = segment.slice(0, 2);
  const word = segment.slice(2);
  if (SUFFIX_PATTERN.test(suffix) && WORD_PATTERN.test(word)) {
    return { suffix, word };
  }
  return null;
}

/** 全セグメントが単語パターンに一致するか */
function allWords(segments: string[]): boolean {
  return segments.every((s) => WORD_PATTERN.test(s));
}

/**
 * パターンA: 最終セグメントにサフィックスが埋め込み
 * 例: masseur_ban1m → ["masseur", "ban1m"]
 */
function matchTrailingEmbedded(segments: string[]): boolean {
  const lastIdx = segments.length - 1;
  const extracted = extractTrailingSuffix(segments[lastIdx]);
  if (!extracted) return false;
  return allWords(segments.slice(0, lastIdx));
}

/**
 * パターンB: 最終セグメントがサフィックス単独
 * 例: pleased-latex-16 → ["pleased", "latex", "16"]
 */
function matchTrailingSeparated(segments: string[]): boolean {
  if (segments.length < 3) return false;
  const lastSegment = segments[segments.length - 1];
  if (!SUFFIX_PATTERN.test(lastSegment)) return false;
  return allWords(segments.slice(0, -1));
}

/**
 * パターンC: 先頭セグメントがサフィックス単独
 * 例: 32.wombats_rebids → ["32", "wombats", "rebids"]
 */
function matchLeadingSeparated(segments: string[]): boolean {
  if (segments.length < 3) return false;
  const firstSegment = segments[0];
  if (!SUFFIX_PATTERN.test(firstSegment)) return false;
  return allWords(segments.slice(1));
}

/**
 * パターンD: 先頭セグメントにサフィックスが埋め込み
 * 例: 08nadir.drape → ["08nadir", "drape"]
 */
function matchLeadingEmbedded(segments: string[]): boolean {
  const extracted = extractLeadingSuffix(segments[0]);
  if (!extracted) return false;
  return allWords(segments.slice(1));
}

/**
 * Apple「メールを非公開（Hide My Email）」で生成されたアドレスかどうかを判定する
 *
 * @param email メールアドレス
 * @returns true = Hide My Email（検知対象）, false = 通常アドレス
 */
export function isHideMyEmail(email: string): boolean {
  const parts = email.toLowerCase().split("@");
  const localPart = parts[0] || "";
  const domain = parts[1] || "";

  // icloud.com 以外は対象外
  if (domain !== HIDE_MY_EMAIL_DOMAIN) return false;

  // セパレータ(.-_)で分割
  const segments = localPart.split(/[.\-_]/);

  // セグメント数チェック（2〜4セグメント）
  if (segments.length < 2 || segments.length > 4) return false;

  // 空セグメントがあれば対象外
  if (segments.some((s) => s.length === 0)) return false;

  return (
    matchTrailingEmbedded(segments) ||
    matchTrailingSeparated(segments) ||
    matchLeadingSeparated(segments) ||
    matchLeadingEmbedded(segments)
  );
}
