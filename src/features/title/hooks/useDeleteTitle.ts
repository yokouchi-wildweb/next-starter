// src/features/title/hooks/useDeleteTitle.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { titleClient } from "../services/client/titleClient";

export const useDeleteTitle = () => useDeleteDomain("titles/delete", titleClient.delete, "titles");
