// src/app/api/[domain]/upsert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serviceRegistry } from "@/registry/serviceRegistry";
import type { DomainParams } from "@/types/params";

// 利用可能なドメインごとのサービスを登録
const services = serviceRegistry;

// PUT /api/[domain]/upsert : 既存データを更新、なければ新規作成
export async function PUT(req: NextRequest, { params }: DomainParams) {
  const { domain } = await params;
  const service = services[domain];
  if (!service || !service.upsert) return new NextResponse("Not Found", { status: 404 });
  try {
    const { data, options } = await req.json();
    const result = await service.upsert(data, options);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/[domain]/upsert failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
