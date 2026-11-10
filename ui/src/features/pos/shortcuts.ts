// POS keyboard map: the single source for the help dialog (F1) and the header hints.
export interface PosShortcut {
  keys: string[];
  label: string;
  group: "Items" | "Bill" | "Payment" | "General";
}

export const POS_SHORTCUTS: PosShortcut[] = [
  { keys: ["F3", "/"], label: "Search items / scan barcode", group: "Items" },
  { keys: ["↑", "↓"], label: "Select a cart line (↓ from an empty search box)", group: "Items" },
  { keys: ["+", "−"], label: "Quantity of the selected line +1 / −1", group: "Items" },
  { keys: ["Enter"], label: "Edit quantity of the selected line", group: "Items" },
  { keys: ["Del"], label: "Remove the selected line", group: "Items" },
  { keys: ["Shift+F9"], label: "Discount on the selected line", group: "Items" },

  { keys: ["F7"], label: "Attach customer (mobile number)", group: "Bill" },
  { keys: ["F9"], label: "Discount on the whole bill", group: "Bill" },
  { keys: ["F8"], label: "Hold bill", group: "Bill" },
  { keys: ["F6"], label: "Held bills", group: "Bill" },
  { keys: ["F10"], label: "New bill (clear the cart)", group: "Bill" },

  { keys: ["Alt+1"], label: "Pay by Cash", group: "Payment" },
  { keys: ["Alt+2"], label: "Pay by UPI", group: "Payment" },
  { keys: ["Alt+3"], label: "Pay by Card", group: "Payment" },
  { keys: ["Alt+4"], label: "Pay later / dues (customer needed)", group: "Payment" },
  { keys: ["F12"], label: "Charge / take payment", group: "Payment" },
  { keys: ["F4"], label: "Exact cash: charge the full total in cash", group: "Payment" },
  { keys: ["Ctrl+P"], label: "Reprint the last bill", group: "Payment" },

  { keys: ["F1"], label: "Show these shortcuts", group: "General" },
  { keys: ["Esc"], label: "Close a dialog / back to search", group: "General" },
];

export const SHORTCUT_GROUPS: PosShortcut["group"][] = ["Items", "Bill", "Payment", "General"];
