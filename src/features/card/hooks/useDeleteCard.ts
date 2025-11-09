// src/features/card/hooks/useDeleteCard.ts

"use client";
import { useDeleteDomain } from "@/lib/crud/hooks";
import { cardClient } from "../services/client/cardClient";

export const useDeleteCard = () =>
  useDeleteDomain("cards/delete", cardClient.delete, "cards");
