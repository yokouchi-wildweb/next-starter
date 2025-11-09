// src/features/card/services/server/wrappers/remove.ts
import { deleteFileServer, getPathFromStorageUrl } from "@/lib/firebase/server/storage";
import { base } from "../drizzleBase";

export async function remove(id: string): Promise<void> {
  const card = await base.get(id);
  await base.remove(id);
  if (card?.mainImageUrl) {
    const path = getPathFromStorageUrl(card.mainImageUrl);
    if (path) {
      try {
        await deleteFileServer(path);
      } catch (error) {
        console.error("Failed to delete file from storage", error);
      }
    }
  }
}
