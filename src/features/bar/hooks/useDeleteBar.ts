// src/features/bar/hooks/useDeleteBar.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { barClient } from "../services/client/barClient";

export const useDeleteBar = () => useDeleteDomain("bars/delete", barClient.delete, "bars");
