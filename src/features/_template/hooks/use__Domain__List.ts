// src/features/__domain__/hooks/use__Domain__List.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { SWRConfiguration } from "swr";

export const use__Domain__List = (config?: SWRConfiguration) =>
  useDomainList<__Domain__>("__domains__", __domain__Client.getAll, config);
