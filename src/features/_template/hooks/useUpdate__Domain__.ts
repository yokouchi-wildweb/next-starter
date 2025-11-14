// src/features/__domain__/hooks/useUpdate__Domain__.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { __Domain__UpdateFields } from "../entities/form";

export const useUpdate__Domain__ = () =>
  useUpdateDomain<__Domain__, __Domain__UpdateFields>(
    "__domains__/update",
    __domain__Client.update,
    "__domains__",
  );
