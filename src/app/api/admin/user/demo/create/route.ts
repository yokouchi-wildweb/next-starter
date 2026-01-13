// src/app/api/admin/user/demo/create/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { createDemoUser } from "@/features/core/user/services/server/creation/console";
import { USER_ROLES } from "@/features/core/user/constants";

const CreateDemoUserPayloadSchema = z.object({
  displayName: z.string(),
  email: z
    .string()
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .email({ message: "メールアドレスの形式が不正です" }),
  role: z.enum(USER_ROLES),
  localPassword: z.string().min(8, { message: "パスワードは8文字以上で入力してください" }),
  profileData: z.record(z.unknown()).optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/user/demo/create",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session || session.role !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = CreateDemoUserPayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    const user = await createDemoUser(parsed.data);

    return NextResponse.json(user);
  },
);
