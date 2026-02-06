// src/features/core/user/utils/phoneNumber.ts

/**
 * E.164形式の電話番号バリデーション正規表現
 * 例: +819012345678
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * 電話番号がE.164形式かどうかを検証する
 */
export function isValidE164(phoneNumber: string): boolean {
  return E164_PHONE_REGEX.test(phoneNumber);
}

/**
 * 日本の電話番号をE.164形式に変換する
 * 例: 09012345678 → +819012345678
 *     090-1234-5678 → +819012345678
 */
export function formatToE164(phoneNumber: string, countryCode = "81"): string {
  // ハイフン、スペース、括弧を除去
  const cleaned = phoneNumber.replace(/[-\s()]/g, "");

  // 既にE.164形式の場合はそのまま返す
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // 先頭の0を除去して国番号を付与
  const withoutLeadingZero = cleaned.replace(/^0/, "");
  return `+${countryCode}${withoutLeadingZero}`;
}

/**
 * E.164形式の電話番号を表示用にフォーマットする
 * 例: +819012345678 → 090-1234-5678
 */
export function formatForDisplay(e164PhoneNumber: string): string {
  // 日本の電話番号の場合
  if (e164PhoneNumber.startsWith("+81")) {
    const nationalNumber = e164PhoneNumber.slice(3);

    // 携帯電話（070, 080, 090）
    if (/^[789]0\d{8}$/.test(nationalNumber)) {
      return `0${nationalNumber.slice(0, 2)}-${nationalNumber.slice(2, 6)}-${nationalNumber.slice(6)}`;
    }

    // 固定電話（簡易フォーマット）
    return `0${nationalNumber}`;
  }

  // その他の国はそのまま返す
  return e164PhoneNumber;
}

/**
 * 電話番号をマスクする（最後の4桁以外を隠す）
 * 例: +819012345678 → +81******5678
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }
  const visible = phoneNumber.slice(-4);
  const masked = "*".repeat(phoneNumber.length - 4);
  return masked + visible;
}
