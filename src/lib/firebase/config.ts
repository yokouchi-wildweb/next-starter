// src/lib/firebase/config.ts
//
// Firebase の設定(既定 + 上書き)。上書きは src/config/lib/firebase.config.ts(@lib-config/firebase)の 1 ファイル。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// - 公開してよい値(FirebasePublicConfig): 上書きに env の NEXT_PUBLIC_FIREBASE_* をその字面で書く(client ではビルド時に埋め込まれる)
// - サーバーだけの値(FirebaseServerConfig): 呼んだ時に読む関数で受け、./server の中でだけ呼ぶ(読み込み時には読まない)
// lib の中では env を読まない(読むのは上書きのファイルだけ)。空の値 = 未設定(isFirebaseClientConfigured / isFirebaseServerConfigured が false)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/firebase";

/** client と server の両方が読む公開の値(Firebase コンソールの Web アプリの設定) */
export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Analytics の測定 ID。空 = Analytics を使わない */
  measurementId: string;
};

/** サーバーだけの値。関数は ./server の中でだけ、使う時に呼ぶ */
export type FirebaseServerConfig = {
  /** サービスアカウントの鍵(JSON の文字列)を返す。空・undefined = Admin は未設定 */
  serviceAccountKey: () => string | undefined;
};

export type FirebaseConfig = FirebasePublicConfig & FirebaseServerConfig;

const defaults: FirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
  serviceAccountKey: () => undefined,
};

export const firebaseConfigDef = defineConfig(defaults, { label: "firebase" });

/** 上書きのファイルの型(`export default { ... } satisfies FirebaseOverride`) */
export type FirebaseOverride<E extends object = Record<never, never>> = OverrideOf<typeof firebaseConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る。鍵の関数はここでは呼ばない) */
export const firebaseConfig: FirebaseConfig = firebaseConfigDef.compose(override);
