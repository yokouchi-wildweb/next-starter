// src/features/title/hooks/useUpdateTitle.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { titleClient } from "../services/client/titleClient";
import type { Title } from "../entities";

export const useUpdateTitle = () => useUpdateDomain<Title>("titles/update", titleClient.update, "titles");
