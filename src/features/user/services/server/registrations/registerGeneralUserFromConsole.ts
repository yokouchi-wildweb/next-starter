// src/features/user/services/server/registrations/registerGeneralUserFromConsole.ts

import type { User } from "@/features/user/entities";
import { UserTable } from "@/features/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/user/entities/schema";
import { DomainError } from "@/lib/errors";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { db } from "@/lib/drizzle";

export type GeneralConsoleRegistrationInput = {
  displayName: string;
  email: string;
  password: string;
  [key: string]: unknown;
};

function validateInput(input: GeneralConsoleRegistrationInput): void {
  if (!input.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  if (!input.password) {
    throw new DomainError("パスワードを入力してください");
  }
}

export async function registerGeneralUserFromConsole(
  data: GeneralConsoleRegistrationInput,
): Promise<User> {
  validateInput(data);

  const auth = getServerAuth();

  const firebaseUser = await (async () => {
    try {
      return await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName || undefined,
      });
    } catch (error) {
      if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
        throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
      }
      throw error;
    }
  })();

  const values = GeneralUserSchema.parse({
    role: "user",
    status: "active",
    providerType: "email",
    providerUid: firebaseUser.uid,
    localPasswordHash: null,
    email: data.email,
    displayName: data.displayName,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}
