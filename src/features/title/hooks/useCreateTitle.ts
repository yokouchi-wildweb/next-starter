// src/features/title/hooks/useCreateTitle.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { titleClient } from "../services/client/titleClient";
import type { Title } from "../entities";
import type { TitleCreateFields } from "../entities/form";

export const useCreateTitle = () => useCreateDomain<Title, TitleCreateFields>("titles/create", titleClient.create, "titles");
