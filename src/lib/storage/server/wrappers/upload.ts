// src/lib/storage/server/wrappers/upload.ts
import { uploadFileServer } from "@/lib/firebase/server/storage";
import { uuidv7 } from "uuidv7";
import type { UploadResult } from "@/lib/storage/types";

export async function upload(basePath: string, file: File): Promise<UploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
  const path = `${basePath}/${uuidv7()}${ext}`;
  const url = await uploadFileServer(path, buffer, file.type);
  return { url, path };
}
