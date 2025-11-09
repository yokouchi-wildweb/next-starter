// src/app/api/[domain]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serviceRegistry } from "@/registry/serviceRegistry";
import { isDomainError } from "@/lib/errors";
import type { DomainParams } from "@/types/params";

// 利用可能なドメインごとのサービスを登録
const services = serviceRegistry;

// GET /api/[domain] : 指定ドメインの一覧を取得
export async function GET(req: NextRequest, { params }: DomainParams) {
  const { domain } = await params;
  const service = services[domain];
  if (!service) return new NextResponse("Not Found", { status: 404 });
  try {
    const list = await service.list();
    return NextResponse.json(list);
  } catch (error) {
    console.error("GET /api/[domain] failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// POST /api/[domain] : 指定ドメインの新規データを作成
export async function POST(req: NextRequest, { params }: DomainParams) {
  const { domain } = await params;
  const service = services[domain];
  if (!service) return new NextResponse("Not Found", { status: 404 });
  try {
    const { data } = await req.json();
    const created = await service.create(data);
    return NextResponse.json(created);
  } catch (error) {
    console.error("POST /api/[domain] failed:", error);

    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
