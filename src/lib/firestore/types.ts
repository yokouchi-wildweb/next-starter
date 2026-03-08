// src/lib/firestore/types.ts

/** onSnapshot の購読解除関数 */
export type Unsubscribe = () => void;

/** Firestore クライアント操作で発生するエラー */
export type FirestoreClientError = {
  message: string;
  code?: string;
  cause?: unknown;
};
