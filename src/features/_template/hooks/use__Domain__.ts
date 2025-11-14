// src/features/__domain__/hooks/use__Domain__.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";

export const use__Domain__ = (id?: string | null) =>
  useDomain<__Domain__ | undefined>(
    id ? `__domain__:${id}` : null,
    () => __domain__Client.getById(id!) as Promise<__Domain__>,
  );
