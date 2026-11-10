import { Kbd } from "@/components/ui/Kbd";
import { Modal } from "@/components/ui/Modal";
import { POS_SHORTCUTS, SHORTCUT_GROUPS } from "./shortcuts";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="md">
      <div className="grid gap-6 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group}>
            <h3 className="mb-2 text-overline font-semibold tracking-wide text-slate uppercase">{group}</h3>
            <ul className="space-y-1.5">
              {POS_SHORTCUTS.filter((s) => s.group === group).map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 text-body text-ink">
                  <span className="min-w-0">{s.label}</span>
                  <span className="flex shrink-0 gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
