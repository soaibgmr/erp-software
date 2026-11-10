import { useEffect, useLayoutEffect, useRef } from "react";

// Keyboard shortcuts. Combos are "[mod+][alt+][shift+]key", e.g. "f12", "mod+k", "alt+1", "shift+f9".
// `mod` is Ctrl or ⌘. Named keys: plus (+ or =), minus, slash, up, down, delete, escape, enter.
// Function keys and mod/alt combos work while typing in a field; other keys are ignored there
// unless allowInInputs is set. skipInDialogs ignores the key while any modal dialog is open;
// `when` is an extra check — if it returns false the key is left alone (no preventDefault).
const ALIASES: Record<string, string[]> = {
  plus: ["+", "="],
  minus: ["-", "_"],
  slash: ["/"],
  up: ["arrowup"],
  down: ["arrowdown"],
  delete: ["delete"],
  escape: ["escape"],
  enter: ["enter"],
};

export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  {
    allowInInputs = false,
    enabled = true,
    skipInDialogs = false,
    when,
  }: { allowInInputs?: boolean; enabled?: boolean; skipInDialogs?: boolean; when?: (e: KeyboardEvent) => boolean } = {},
) {
  // Latest handler without re-subscribing on every render.
  const saved = useRef(handler);
  const guard = useRef(when);
  useLayoutEffect(() => {
    saved.current = handler;
    guard.current = when;
  });

  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split("+");
    const key = parts.pop()!;
    const wantMod = parts.includes("mod");
    const wantAlt = parts.includes("alt");
    const wantShift = parts.includes("shift");
    const keys = ALIASES[key] ?? [key];
    const isFunctionKey = /^f\d{1,2}$/.test(key);
    const isDigit = /^\d$/.test(key);
    // Printable keys like "+" need Shift on some layouts, so Shift only counts for named/function keys.
    const shiftMatters = wantShift || isFunctionKey || key.length > 1;

    const onKey = (e: KeyboardEvent) => {
      const pressed = e.key.toLowerCase();
      // With Alt, macOS turns digits into symbols, so fall back to the physical key.
      const matches = keys.includes(pressed) || (isDigit && e.code === `Digit${key}`);
      if (!matches) return;
      if (wantMod !== (e.ctrlKey || e.metaKey)) return;
      if (wantAlt !== e.altKey) return;
      if (shiftMatters && wantShift !== e.shiftKey) return;
      if (skipInDialogs && document.querySelector('[role="dialog"]')) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if (typing && !allowInInputs && !isFunctionKey && !wantMod && !wantAlt) return;
      // Extra condition; when false the key keeps its normal browser behaviour.
      if (guard.current && !guard.current(e)) return;
      e.preventDefault();
      saved.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, allowInInputs, enabled, skipInDialogs]);
}
