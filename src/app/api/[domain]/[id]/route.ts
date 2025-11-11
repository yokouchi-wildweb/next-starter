// src/app/api/[domain]/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serviceRegistry } from "@/registry/serviceRegistry";
import type { DomainIdParams } from "@/types/params";

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
export async function PUT(req: NextRequest, { params }: DomainIdParams) {
  const { domain, id } = await params;
  const service = services[domain];
  if (!service) return new NextResponse("Not Found", { status: 404 });
  try {
    const { data } = await req.json();
    const updated = await service.update(id, data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/[domain]/[id] failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
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
