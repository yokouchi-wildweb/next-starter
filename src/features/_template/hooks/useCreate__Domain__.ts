// src/features/__domain__/hooks/useCreate__Domain__.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { __Domain__CreateFields } from "../entities/form";

export const useCreate__Domain__ = () =>
  useCreateDomain<__Domain__, __Domain__CreateFields>("__domains__/create", __domain__Client.create, "__domains__");
