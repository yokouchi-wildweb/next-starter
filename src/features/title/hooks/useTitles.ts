// src/features/title/hooks/useTitles.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { titleClient } from "../services/client/titleClient";
import type { Title } from "../entities";
import type { SWRConfiguration } from "swr";

export const useTitles = (config?: SWRConfiguration) =>
  useDomainList<Title>("titles", titleClient.getAll, config);
