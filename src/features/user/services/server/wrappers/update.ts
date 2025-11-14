// src/features/user/services/server/wrappers/update.ts

import { DomainError } from "@/lib/errors";
import { GeneralUserOptionalSchema } from "@/features/user/entities";
import type { UpdateUserInput } from "@/features/user/services/types";
import { hashPassword } from "@/utils/password";

import { base } from "../drizzleBase";

export async function update(id: string, data: UpdateUserInput) {
  const current = await base.get(id);

  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const payload: UpdateUserInput = { ...data };

  if (payload.password !== undefined) {
    const trimmed = payload.password?.trim() ?? "";

    if (trimmed.length === 0) {
      throw new DomainError("パスワードを入力してください");
    }

    payload.localPasswordHash = await hashPassword(trimmed);
  }

  delete payload.password;

  GeneralUserOptionalSchema.parse({
    ...current,
    ...payload,
  });

  const updateKeys = Object.keys(payload) as Array<keyof typeof payload>;
  if (updateKeys.length === 0) {
    return current;
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of updateKeys) {
    const value = payload[key];
    if (value !== undefined) {
      sanitized[key as string] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return current;
  }

  return base.update(id, sanitized as UpdateUserInput);
}
