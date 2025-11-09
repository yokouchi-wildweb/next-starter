// src/features/__domain__/hooks/useDelete__Domain__.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";

export const useDelete__Domain__ = () => useDeleteDomain("__domains__/delete", __domain__Client.delete, "__domains__");
