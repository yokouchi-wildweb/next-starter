// src/app/api/[domain]/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { GeneralUserOptionalSchema } from "@/features/user/entities";
import type { User } from "@/features/user/entities";
import type { UpdateUserInput } from "@/features/user/services/types";
import { hashPassword } from "@/utils/password";
import { serviceRegistry } from "@/registry/serviceRegistry";
import type { DomainIdParams } from "@/types/params";
import { ZodError } from "zod";

// 利用可能なドメインごとのサービスを登録
const services = serviceRegistry;

// GET /api/[domain]/[id] : IDで単一データを取得
export async function GET(_: NextRequest, { params }: DomainIdParams) {
  const { domain, id } = await params;
  const service = services[domain];
  if (!service) return new NextResponse("Not Found", { status: 404 });
  try {
    const data = await service.get(id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/[domain]/[id] failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PUT /api/[domain]/[id] : 指定IDのデータを更新
type UserUpdateFields = Pick<User, "displayName" | "email" | "localPasswordHash">;

type UserCrudService = {
  get(id: string): Promise<User | undefined>;
  update(id: string, data: Partial<UserUpdateFields>): Promise<User>;
};

export async function PUT(req: NextRequest, { params }: DomainIdParams) {
  const { domain, id } = await params;
  const service = services[domain];
  if (!service) return new NextResponse("Not Found", { status: 404 });
  try {
    const { data } = await req.json();

    if (domain === "user") {
      return await handleUserUpdate(service as UserCrudService, id, data as UpdateUserInput | undefined);
    }

    const updated = await service.update(id, data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/[domain]/[id] failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

async function handleUserUpdate(service: UserCrudService, id: string, rawData?: UpdateUserInput) {
  if (!rawData || typeof rawData !== "object") {
    return NextResponse.json({ message: "更新データが不正です" }, { status: 400 });
  }

  const current = await service.get(id);
  if (!current) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (current.providerType === "local") {
    return NextResponse.json(
      {
        message:
          "現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。",
      },
      { status: 400 },
    );
  }

  const payload: UpdateUserInput = { ...rawData };

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
        payload.localPasswordHash = await hashPassword(trimmedPassword);
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
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "入力値が不正です" }, { status: 400 });
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
    return NextResponse.json(current);
  }

  const updated = await service.update(id, sanitized);
  return NextResponse.json(updated);
}

// DELETE /api/[domain]/[id] : 指定IDのデータを削除
export async function DELETE(_: NextRequest, { params }: DomainIdParams) {
  const { domain, id } = await params;
  const service = services[domain];
  if (!service) return new NextResponse("Not Found", { status: 404 });
  try {
    await service.remove(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/[domain]/[id] failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
