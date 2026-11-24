// src/lib/userDirty/server.ts — 再計算の回収口の入口(node の AsyncLocalStorage を使うので server だけが読む)
// 入口(route factory など)が runWithUserDirtyTracking で包み、業務の側が markUserDirty で積む。

export {
  markUserDirty,
  runWithUserDirtyTracking,
  registerUserDirtyFlushHandler,
  type UserDirtyFlushHandler,
} from "./context";
