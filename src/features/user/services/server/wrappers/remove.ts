// src/features/user/services/server/wrappers/remove.ts
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { base } from "../drizzleBase";

export async function remove(id: string): Promise<void> {
  const user = await base.get(id);

  if (user?.role === "user") {
    const auth = getServerAuth();
    try {
      await auth.deleteUser(user.providerUid);
    } catch (error) {
      if (hasFirebaseErrorCode(error, "auth/user-not-found")) {
        console.warn("Firebase user already removed for uid", user.providerUid);
      } else {
        throw error;
      }
    }
  }

  await base.remove(id);
}
