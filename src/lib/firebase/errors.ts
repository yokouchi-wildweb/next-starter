// src/lib/firebase/errors.ts

/**
 * Firebase SDK が投げるエラーオブジェクトの中から、指定したコードを持つか判定します。
 *
 * Firebase のエラーは Error を継承した独自クラスであり、`code` プロパティで種類を識別します。
 * このヘルパーでは `code` の存在と型を確認した上で比較することで、安全にハンドリングできます。
 * Firebase Admin SDK の一部では `errorInfo.code` のみにエラーコードが格納されるため、
 * そのケースも含めてチェックする。
 */
type FirebaseErrorLike = {
  code?: unknown;
  errorInfo?: {
    code?: unknown;
  };
};

/**
 * Firebase エラーコードから日本語メッセージへのマッピング（電話番号認証用）
 */
const PHONE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  // SMS送信関連
  "auth/invalid-phone-number": "電話番号の形式が正しくありません。",
  "auth/missing-phone-number": "電話番号が入力されていません。",
  "auth/too-many-requests": "リクエストが多すぎます。しばらく経ってからお試しください。",
  "auth/quota-exceeded": "SMSの送信上限に達しました。しばらく経ってからお試しください。",
  "auth/captcha-check-failed": "reCAPTCHAの検証に失敗しました。ページを再読み込みしてお試しください。",
  "auth/operation-not-allowed": "電話番号認証が現在利用できません。",
  "auth/user-disabled": "このアカウントは無効化されています。",
  "auth/network-request-failed": "ネットワークエラーが発生しました。接続を確認してください。",
  // リンク関連
  "auth/provider-already-linked": "電話番号は既にこのアカウントに登録されています。",
  "auth/credential-already-in-use": "この電話番号は既に他のアカウントで使用されています。",
  "auth/account-exists-with-different-credential": "この電話番号は既に他のアカウントで使用されています。",
  // OTP検証関連
  "auth/invalid-verification-code": "認証コードが正しくありません。",
  "auth/code-expired": "認証コードの有効期限が切れました。再送信してください。",
  "auth/missing-verification-code": "認証コードが入力されていません。",
  "auth/invalid-verification-id": "認証セッションが無効です。最初からやり直してください。",
  "auth/session-expired": "セッションの有効期限が切れました。最初からやり直してください。",
  // その他
  "auth/internal-error": "内部エラーが発生しました。しばらく経ってからお試しください。",
  "auth/invalid-app-credential": "アプリの認証情報が無効です。ページを再読み込みしてお試しください。",
  "auth/missing-app-credential": "アプリの認証情報が見つかりません。ページを再読み込みしてお試しください。",
};

/**
 * Firebase エラーから日本語メッセージを取得する
 * @param error - catchしたエラーオブジェクト
 * @param fallbackMessage - マッピングにないエラーの場合のデフォルトメッセージ
 * @returns 日本語のエラーメッセージ
 */
export function getFirebasePhoneAuthErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (!error || typeof error !== "object") {
    return fallbackMessage;
  }

  const candidate = error as FirebaseErrorLike;
  const code =
    (typeof candidate.code === "string" ? candidate.code : undefined) ??
    (typeof candidate.errorInfo?.code === "string" ? candidate.errorInfo.code : undefined);

  if (code && code in PHONE_AUTH_ERROR_MESSAGES) {
    return PHONE_AUTH_ERROR_MESSAGES[code];
  }

  return fallbackMessage;
}

export function hasFirebaseErrorCode(
  error: unknown,
  expectedCode: string,
): error is FirebaseErrorLike {
  if (typeof expectedCode !== "string") {
    return false;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as FirebaseErrorLike;
  const directCode = typeof candidate.code === "string" ? candidate.code : undefined;
  const nestedCode = typeof candidate.errorInfo?.code === "string" ? candidate.errorInfo.code : undefined;

  if (directCode === expectedCode || nestedCode === expectedCode) {
    return true;
  }

  return false;
}
