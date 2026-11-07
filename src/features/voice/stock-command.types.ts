import type { VoiceCorrectionField } from "./voice.service";

export type StockCommand = {
  action: "search" | "add" | "edit" | "quantity" | "delete" | "clarify";
  target: string | null;
  categoryId: string | null;
  mode: "set" | "increase" | "decrease" | null;
  amount: number | null;
  unit: "meters" | "boxes" | "pallets" | "pieces" | null;
  question: string | null;
} & Record<Exclude<VoiceCorrectionField, "quantity">, string | null>;

export type StockAnalysis = { transcript: string; command: StockCommand };
