// src/features/core/user/services/server/creation/console/createGeneralUser.ts

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { DomainError } from "@/lib/errors";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { db } from "@/lib/drizzle";

export type CreateGeneralUserInput = {
  displayName: string;
  email: string;
  localPassword: string;
  [key: string]: unknown;
};

function validateInput(input: CreateGeneralUserInput): void {
  if (!input.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  if (!input.localPassword) {
    throw new DomainError("パスワードを入力してください");
  }
}

export async function createGeneralUser(data: CreateGeneralUserInput): Promise<User> {
  validateInput(data);

  const auth = getServerAuth();

  const firebaseUser = await (async () => {
    try {
      return await auth.createUser({
        email: data.email,
        password: data.localPassword,
        displayName: data.displayName || undefined,
      });
    } catch (error) {
      if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
        throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
      }
      throw error;
    }
  })();

  const values = await GeneralUserSchema.parseAsync({
    role: "user",
    status: "active",
    providerType: "email",
    providerUid: firebaseUser.uid,
    localPassword: null,
    email: data.email,
    displayName: data.displayName,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}
