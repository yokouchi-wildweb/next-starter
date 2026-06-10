// src/app/api/[domain]/[id]/duplicate/route.ts

import { z } from "zod";

import { createDomainIdRoute } from "src/lib/routeFactory";
import { DomainError } from "@/lib/errors";

// duplicate は取得済みレコードを create に渡す経路で、ドメインの create スキーマ検証を
// 通らないため、ユーザー入力の name はここで検証する
const duplicateBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});

// POST /api/[domain]/[id]/duplicate : 指定IDのデータを複製
export const POST = createDomainIdRoute(
  {
    operation: "POST /api/[domain]/[id]/duplicate",
    operationType: "write",
    supports: "duplicate",
  },
  async (req, { service, params }) => {
    // 既存クライアントは body なしで呼ぶため、空 body は許容する
    const body = await req.json().catch(() => null);
    const parsed = duplicateBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new DomainError("name は1〜255文字の文字列で指定してください", { status: 400 });
    }
    return service.duplicate(params.id, parsed.data);
  },
);
