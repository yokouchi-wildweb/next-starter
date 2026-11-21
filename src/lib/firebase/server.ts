// src/lib/firebase/server.ts
// 入口 "./server": Firebase Admin SDK(遅延初期化)とサービスアカウントの鍵の読み出し。Auth のユーザー操作。
export {
  getServerApp,
  getServerAuth,
  getServerFirestore,
  getServerStorage,
  isFirebaseServerConfigured,
} from "./server/app";
export { deleteAuthUser, disableAuthUser, enableAuthUser, getAuthUser, revokeAuthTokens } from "./server/authAdmin";
