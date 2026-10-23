// src/features/core/storageObject/services/server/http.ts
//
// ルート（/api/me/storage/**・/api/storage/objects/**）の入力の検証と、非公開ファイルの読み取り応答。

import { NextResponse } from "next/server";
import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { ReadResolution } from "./storageObjectService";

/**
 * POST /api/me/storage/uploads の入力。
 * strict: 保存先のキー・所有者などを利用者が指定する余地を作らない（未知のキーは 400）。
 */
export const issueUploadInputSchema = z
  .object({
    purpose: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    size: z.number().int().positive(),
    scopeId: z.string().trim().min(1).nullish(),
  })
  .strict();

export type IssueUploadInput = z.infer<typeof issueUploadInputSchema>;

export async function parseIssueUploadInput(req: Request): Promise<IssueUploadInput> {
  const body = await req.json().catch(() => undefined);
  const parsed = issueUploadInputSchema.safeParse(body);
  if (!parsed.success) throw new DomainError("入力が不正です", { status: 400 });
  return parsed.data;
}

const OBJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** パスの台帳 ID を検証する。形式違いは 404（存在しないものとして扱う） */
export function parseObjectId(value: string | undefined): string {
  if (!value || !OBJECT_ID_PATTERN.test(value)) {
    throw new DomainError("ファイルが見つかりません", { status: 404 });
  }
  return value;
}

/**
 * 302 と失敗応答に付けるヘッダー。
 * 署名 URL への転送は利用者ごと・都度の判定なので、共有キャッシュにも端末のキャッシュにも残さない。
 */
export const PRIVATE_READ_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};

/** 読み取りの解決結果を応答にする。失敗応答には Location を付けない */
export function readResolutionResponse(resolution: ReadResolution): NextResponse {
  if (resolution.kind === "redirect") {
    return new NextResponse(null, {
      status: 302,
      headers: { ...PRIVATE_READ_HEADERS, Location: resolution.url },
    });
  }
  if (resolution.kind === "unauthenticated") {
    return NextResponse.json({ message: "認証が必要です。" }, { status: 401, headers: PRIVATE_READ_HEADERS });
  }
  return NextResponse.json({ message: "ファイルが見つかりません" }, { status: 404, headers: PRIVATE_READ_HEADERS });
}

/** 判定中の例外（DB・判定先の障害など）の応答。署名 URL は返さない */
export function readFailureResponse(): NextResponse {
  return NextResponse.json(
    { message: "サーバーでエラーが発生しました" },
    { status: 500, headers: PRIVATE_READ_HEADERS },
  );
}
