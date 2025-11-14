// src/lib/storage/server/wrappers/remove.ts
import { deleteFileServer, getPathFromStorageUrl } from "@/lib/firebase/server/storage";

export async function remove(pathOrUrl: string): Promise<void> {
  const path = getPathFromStorageUrl(pathOrUrl) ?? pathOrUrl;
  await deleteFileServer(path);
}
