// src/lib/userDirty/index.ts

export {
  markUserDirty,
  runWithUserDirtyTracking,
  registerUserDirtyFlushHandler,
  type UserDirtyFlushHandler,
} from "./context";
