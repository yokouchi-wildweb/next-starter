// src/app/api/media/probe/route.ts
//
// サーバーサイド メディア解析（probe）の内部 API アダプタ。
// 共有ライブラリ関数 probeMedia() の薄いラッパ。別ランタイム/クライアントからの事前検証用。
// 管理ツール用途のため admin 限定（access: "custom" + requireAdmin の自前ガード）。
//
// 入力（どれか 1 つ）:
// - ref: storage:// の ref（downloadUrl に ref を入れても同じ扱い）
//   - priv: 用途の read 規則を、この管理者で storageObjectService.resolveRead が判定する。
//     admin だからといって全用途を読めるわけではない（暗黙の通過なし。読めない用途は 404）。
//     許可されたら probe 用の短期署名 URL を lib に渡す（ブラウザには返さない）
//   - pub: 公開 URL（resolveStorageSrc）をそのまま渡す
// - storagePath: 旧バケット内のパス。pub / priv の保存先と重なるパスは 400（管理下の物を迂回して署名させない）
// - downloadUrl: 自分の旧バケットの URL は旧バケットの位置として署名、それ以外の URL はそのまま Range 取得

import { NextResponse } from "next/server";

import { requireAdmin } from "@/features/core/auth/services/server/requireRole";
import { storageObjectService } from "@/features/core/storageObject/services/server/storageObjectService";
import { probeMedia } from "@/lib/mediaProbe";
import type { MediaRef, ProbeErrorCode } from "@/lib/mediaProbe";
import { createApiRoute } from "@/lib/routeFactory";
import { isStorageRef, parseStorageRef, resolveStorageSrc } from "@/lib/storage";
import { legacyLocationOfPath } from "@/lib/storage/server";

type ProbeInput = { ref: string } | { storagePath: string } | { downloadUrl: string };

/** リクエストボディから入力を取り出す。 */
function parseInput(body: unknown): ProbeInput | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const text = (key: string) => {
    const value = obj[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  };
  const ref = text("ref");
  if (ref) return { ref };
  const storagePath = text("storagePath");
  if (storagePath) return { storagePath };
  const downloadUrl = text("downloadUrl");
  if (downloadUrl) return isStorageRef(downloadUrl) ? { ref: downloadUrl } : { downloadUrl };
  return null;
}

/** probe の失敗コード → HTTP ステータス。 */
const ERROR_STATUS: Record<ProbeErrorCode, number> = {
  fetch_failed: 404,
  unsupported_container: 415,
  probe_failed: 422,
  timeout: 504,
};

const badRequest = (message: string) => NextResponse.json({ message }, { status: 400 });

export const POST = createApiRoute(
  {
    operation: "POST /api/media/probe",
    operationType: "read",
    access: "custom", // ハンドラ内で requireAdmin により認可
  },
  async (req) => {
    const admin = await requireAdmin();

    const body = await req.json().catch(() => null);
    const input = parseInput(body);
    if (!input) {
      return badRequest("ref、storagePath、downloadUrl のいずれかを指定してください。");
    }

    let mediaRef: MediaRef;
    if ("ref" in input) {
      const parsed = parseStorageRef(input.ref);
      if (!parsed) return badRequest("ファイルの参照が不正です。");
      if (parsed.store === "priv") {
        const resolution = await storageObjectService.resolveRead(parsed.ledgerId, {
          use: "probe",
          loadUser: async () => admin,
        });
        if (resolution.kind !== "redirect") {
          return NextResponse.json({ message: "ファイルが見つかりません。" }, { status: 404 });
        }
        mediaRef = { authorizedUrl: resolution.url };
      } else {
        const src = resolveStorageSrc(input.ref);
        if (!src) return NextResponse.json({ message: "公開ファイルの URL を作れません。" }, { status: 404 });
        mediaRef = { authorizedUrl: src };
      }
    } else if ("storagePath" in input) {
      if (!legacyLocationOfPath(input.storagePath)) {
        return badRequest("storagePath は旧バケット内のパスだけを指定できます。");
      }
      mediaRef = { storagePath: input.storagePath };
    } else {
      mediaRef = { downloadUrl: input.downloadUrl };
    }

    const result = await probeMedia(mediaRef);
    if (!result.ok) {
      return NextResponse.json(
        { message: result.error.message, code: result.error.code },
        { status: ERROR_STATUS[result.error.code] },
      );
    }

    return NextResponse.json(result);
  },
);
