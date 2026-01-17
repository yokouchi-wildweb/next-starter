"use client";

export type StorageType = "local" | "session";

export type StorageClient = {
  save: (key: string, value: string) => void;
  load: (key: string) => string | null;
  remove: (key: string) => void;
  exists: (key: string) => boolean;
  clear: () => void;
};
