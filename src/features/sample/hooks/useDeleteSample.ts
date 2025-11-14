// src/features/sample/hooks/useDeleteSample.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";

export const useDeleteSample = () => useDeleteDomain("samples/delete", sampleClient.delete, "samples");
