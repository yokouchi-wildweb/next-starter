// src/app/api/[domain]/bulk/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serviceRegistry } from "@/registry/serviceRegistry";
import type { DomainParams } from "@/types/params";

// 利用可能なドメインごとのサービスを登録
const services = serviceRegistry;

// POST /api/[domain]/bulk/delete : 複数IDをまとめて削除
export async function POST(req: NextRequest, { params }: DomainParams) {
  const { domain } = await params;
  const service = services[domain];
  if (!service || !service.bulkDelete) return new NextResponse("Not Found", { status: 404 });
  try {
    const { ids } = await req.json();
    await service.bulkDelete(ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/[domain]/bulk/delete failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
