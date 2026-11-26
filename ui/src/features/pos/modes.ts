export type PosMode = "CASH" | "UPI" | "CARD" | "CREDIT";
// Order matters: Alt+1 … Alt+4.
export const MODES: { value: PosMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CREDIT", label: "Pay later" },
];
