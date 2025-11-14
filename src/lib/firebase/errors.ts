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
