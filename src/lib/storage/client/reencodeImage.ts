// src/lib/storage/client/reencodeImage.ts
//
// アップロード前に画像をブラウザで描き直し、EXIF（撮影位置など）を落とす。既定で ON（uploadToStorage の reencodeImage）。
// - 対象: image/jpeg・image/png・image/webp。gif（アニメーション）・svg・その他はそのまま返す
// - 向きは createImageBitmap が EXIF に従って補正してから描く（imageOrientation: "from-image"）
// - 描き直した方が元より大きくても、EXIF を落とす約束を優先して描き直した方を使う
// - ブラウザに createImageBitmap / canvas が無いときは、描き直さずにそのまま返す（console に警告）
// サーバーでは強制しない（迂回できる。報告書の決定）。

"use client";

const REENCODE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const JPEG_WEBP_QUALITY = 0.92;

export type ImageCodec = {
  /** 描き直せる環境か */
  available: () => boolean;
  /** 画像を描き直して同じ型で書き出す */
  redraw: (file: Blob, type: string, quality: number) => Promise<Blob>;
};

export const browserImageCodec: ImageCodec = {
  available: () =>
    typeof createImageBitmap === "function" &&
    (typeof OffscreenCanvas === "function" || typeof document !== "undefined"),
  async redraw(file, type, quality) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        return await canvas.convertToBlob({ type, quality });
      }
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像の書き出しに失敗しました"))), type, quality),
      );
    } finally {
      bitmap.close();
    }
  },
};

export function shouldReencode(type: string): boolean {
  return REENCODE_TYPES.has(type.toLowerCase());
}

/** 描き直した Blob（対象外・描き直せない環境では元の file）を返す */
export async function reencodeImage(file: Blob, codec: ImageCodec = browserImageCodec): Promise<Blob> {
  const type = file.type.toLowerCase();
  if (!shouldReencode(type)) return file;
  if (!codec.available()) {
    console.warn("[storage] この環境では画像を描き直せないため、EXIF を落とさずにアップロードします");
    return file;
  }
  const quality = type === "image/png" ? 1 : JPEG_WEBP_QUALITY;
  const redrawn = await codec.redraw(file, type, quality);
  // 書き出しが別の型にフォールバックした場合（toBlob が型に未対応など）も、その型のまま送る
  return redrawn.type ? redrawn : new Blob([redrawn], { type });
}
