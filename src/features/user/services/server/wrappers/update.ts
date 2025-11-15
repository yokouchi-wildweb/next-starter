// src/features/user/services/server/wrappers/update.ts

import type { User } from "@/features/user/entities";
import { GeneralUserOptionalSchema } from "@/features/user/entities";
import type { UpdateUserInput } from "../../types";
import { createHash } from "@/utils/string";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";
import { ZodError } from "zod";

type UserUpdateFields = Pick<User, "displayName" | "email" | "localPasswordHash">;

export async function update(id: string, rawData?: UpdateUserInput): Promise<User> {
  if (!rawData || typeof rawData !== "object") {
    throw new DomainError("更新データが不正です", { status: 400 });
  }

  const current = await base.get(id);
  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (current.providerType === "local") {
    throw new DomainError(
      "現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。",
      { status: 400 },
    );
  }

  const payload: UpdateUserInput & { localPasswordHash?: string | null } = { ...rawData };

  if (typeof payload.displayName === "string") {
    const trimmedDisplayName = payload.displayName.trim();
    payload.displayName = trimmedDisplayName.length > 0 ? trimmedDisplayName : null;
  }

  if (current.providerType === "email") {
    if (typeof payload.email === "string") {
      payload.email = payload.email.trim();
    }

    if (typeof payload.password === "string") {
      const trimmedPassword = payload.password.trim();
      if (trimmedPassword.length > 0) {
        payload.localPasswordHash = await createHash(trimmedPassword);
      }
    }
  } else {
    delete payload.email;
    delete payload.localPasswordHash;
  }

  delete payload.password;

  try {
    GeneralUserOptionalSchema.parse({
      ...current,
      ...payload,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.errors[0]?.message ?? "入力値が不正です";
      throw new DomainError(message, { status: 400 });
    }
    throw error;
  }

  const sanitized: Partial<UserUpdateFields> = {};

  if ("displayName" in payload) {
    sanitized.displayName = payload.displayName ?? null;
  }

  if ("email" in payload) {
    sanitized.email = payload.email ?? null;
  }

  if ("localPasswordHash" in payload) {
    sanitized.localPasswordHash = payload.localPasswordHash ?? null;
  }

  if (Object.keys(sanitized).length === 0) {
    return current;
  }

  return base.update(id, sanitized);
}
