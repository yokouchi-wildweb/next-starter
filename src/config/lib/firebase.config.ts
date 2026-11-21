// src/config/lib/firebase.config.ts
// Firebase の設定の上書き(@lib-config/firebase)。キーと既定: src/lib/firebase/config.ts
// - 公開の値は process.env.NEXT_PUBLIC_FIREBASE_* をこの形のまま書く(client ではビルド時に埋め込まれる。変数を介すと埋め込まれない)
// - serviceAccountKey は関数のまま(呼んだ時に読む。lib の ./server だけが呼ぶ)
import type { FirebaseOverride } from "@/lib/firebase";

export default {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  serviceAccountKey: () => process.env.MY_SERVICE_ACCOUNT_KEY,
} satisfies FirebaseOverride;
