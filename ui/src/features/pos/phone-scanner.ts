import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { ScanPoll, ScanSessionCreated } from "@/lib/types";

// A phone paired with this POS as a camera barcode scanner. The phone posts barcodes to the API;
// this hook polls them (about once a second) and hands them to the billing screen in order.
// The pairing is kept in sessionStorage per branch, so a page refresh doesn't drop it.

export interface PhoneSession {
  id: string;
  token: string;
  branchId: string;
  // Id of the last scan already handed to the cart.
  cursor: string | null;
}

const POLL_MS = 1000;
const HIDDEN_POLL_MS = 4000;
const storageKey = (branchId: string) => `ami.pos.phone.${branchId}`;

function load(branchId: string | null): PhoneSession | null {
  if (!branchId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(branchId));
    return raw ? (JSON.parse(raw) as PhoneSession) : null;
  } catch {
    return null;
  }
}

function save(branchId: string, session: PhoneSession | null) {
  try {
    if (session) sessionStorage.setItem(storageKey(branchId), JSON.stringify(session));
    else sessionStorage.removeItem(storageKey(branchId));
  } catch {
    // Storage blocked: the pairing still works until the page reloads.
  }
}

/** The link the phone opens (the QR code). The token is in the #hash, so it never reaches server logs. */
export const phoneScanUrl = (s: PhoneSession) => `${window.location.origin}/scan/${s.id}#${s.token}`;

export type ScanListener = (codes: string[]) => void;

export function usePhoneScanner(branchId: string | null) {
  const [session, setSession] = useState<PhoneSession | null>(() => load(branchId));
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const sessionRef = useRef(session);
  // Scans waiting for the billing screen (e.g. while it isn't mounted yet).
  const queue = useRef<string[]>([]);
  const listener = useRef<ScanListener | null>(null);

  const update = useCallback((next: PhoneSession | null) => {
    const prev = sessionRef.current;
    if (next) save(next.branchId, next);
    else if (prev) save(prev.branchId, null);
    sessionRef.current = next;
    setSession(next);
    if (!next) setPhoneConnected(false);
  }, []);

  const flush = useCallback(() => {
    if (!listener.current || !queue.current.length) return;
    const codes = queue.current;
    queue.current = [];
    listener.current(codes);
  }, []);

  // A branch switch shows that branch's own pairing (if any)...
  const [forBranch, setForBranch] = useState(branchId);
  if (forBranch !== branchId) {
    setForBranch(branchId);
    setSession(load(branchId));
    setPhoneConnected(false);
  }
  // ...and ends the other branch's phone scanner (its scans would go to the wrong cart).
  // Runs before sessionRef catches up below, so it still sees the old branch's session.
  useEffect(() => {
    const old = sessionRef.current;
    if (old && old.branchId !== branchId) {
      save(old.branchId, null);
      queue.current = [];
      void api.delete(`/pos/scan-sessions/${old.id}`).catch(() => {});
    }
  }, [branchId]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const s = sessionRef.current;
      if (stopped || !s || s.id !== sessionId) return;
      try {
        const res = await api.get<ScanPoll>(`/pos/scan-sessions/${s.id}/scans`, { after: s.cursor });
        if (stopped) return;
        if (res.closed) {
          update(null);
          return;
        }
        setPhoneConnected(res.phoneConnected);
        const last = res.scans[res.scans.length - 1];
        if (last) {
          update({ ...s, cursor: last.id });
          queue.current.push(...res.scans.map((x) => x.code));
          flush();
        }
      } catch {
        // Network blip: keep trying quietly. "Stop phone scanner" clears it.
      }
      if (!stopped) timer = setTimeout(() => void tick(), document.hidden ? HIDDEN_POLL_MS : POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [sessionId, update, flush]);

  const start = useCallback(async () => {
    if (!branchId) return;
    setStarting(true);
    try {
      const created = await api.post<ScanSessionCreated>("/pos/scan-sessions");
      queue.current = [];
      update({ id: created.id, token: created.token, branchId, cursor: null });
    } finally {
      setStarting(false);
    }
  }, [branchId, update]);

  const end = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    update(null);
    queue.current = [];
    await api.delete(`/pos/scan-sessions/${s.id}`).catch(() => {});
  }, [update]);

  /** The billing screen subscribes here; queued scans are delivered at once. */
  const subscribe = useCallback(
    (fn: ScanListener) => {
      listener.current = fn;
      flush();
      return () => {
        if (listener.current === fn) listener.current = null;
      };
    },
    [flush],
  );

  return { session, phoneConnected, starting, start, end, subscribe };
}

export type PhoneScanner = ReturnType<typeof usePhoneScanner>;
