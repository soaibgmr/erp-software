import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { AlertTriangle, CheckCircle2, Flashlight, Loader2, ScanBarcode, XCircle } from "lucide-react";
import { formatINR } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { ApiError, api } from "@/lib/api-client";
import type { ScanResult, ScanSessionInfo } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

// The phone side of "Scan with phone" (opened from the QR code on the POS). No login: the token in the
// link's #hash lets this page post barcodes to that one counter. Scanned parts appear in the PC's bill.

type Phase =
  | { kind: "connecting" }
  | { kind: "ready" }
  | { kind: "ended"; message: string }
  | { kind: "invalid"; message: string };

interface Entry {
  key: number;
  code: string;
  status: "sending" | "found" | "missing" | "error";
  name?: string | null;
  price?: string | null;
  message?: string;
}

// Same part held in front of the camera: count it once, not every frame.
const REPEAT_MS = 1500;
const PING_MS = 30_000;

// The browser's own barcode reader (Android Chrome). iPhone Safari doesn't have it, so ZXing is loaded there.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code"];

const scanHeaders = (token: string) => ({ "x-scan-token": token });

export function PhoneScanPage() {
  const { sessionId = "" } = useParams();
  const [token] = useState(() => decodeURIComponent(window.location.hash.slice(1)));
  const [phase, setPhase] = useState<Phase>(() =>
    token
      ? { kind: "connecting" }
      : { kind: "invalid", message: "This link is incomplete. Scan the QR code on the counter PC again." },
  );
  // Remounting the camera is how "Try again" restarts it.
  const [cameraKey, setCameraKey] = useState(0);
  const [info, setInfo] = useState<ScanSessionInfo | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [manual, setManual] = useState("");

  // Tell the user plainly when the counter stopped this scanner or the link is wrong.
  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.code === "SCAN_SESSION_ENDED") {
      setPhase({ kind: "ended", message: err.message });
      return true;
    }
    if (err instanceof ApiError && (err.status === 401 || err.status === 400 || err.status === 403)) {
      setPhase({ kind: "invalid", message: err.message });
      return true;
    }
    return false;
  }, []);

  // Connect, then keep the PC's "Phone connected" light on while this page is open.
  useEffect(() => {
    if (!token) return;
    let live = true;
    const ping = async (first: boolean) => {
      try {
        const res = await api.post<ScanSessionInfo>(
          `/scan-sessions/${sessionId}/ping`,
          {},
          {
            auth: false,
            headers: scanHeaders(token),
          },
        );
        if (!live) return;
        setInfo(res);
        if (first) setPhase({ kind: "ready" });
      } catch (err) {
        if (!live) return;
        if (!handleError(err) && first) {
          setPhase({ kind: "invalid", message: errorMessage(err) });
        }
      }
    };
    void ping(true);
    const timer = setInterval(() => void ping(false), PING_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [sessionId, token, handleError]);

  const nextKey = useRef(0);
  const send = useCallback(
    async (code: string) => {
      const key = ++nextKey.current;
      setEntries((list) => [{ key, code, status: "sending" as const }, ...list].slice(0, 30));
      const patch = (p: Partial<Entry>) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...p } : e)));
      try {
        const res = await api.post<ScanResult>(
          `/scan-sessions/${sessionId}/scans`,
          { code },
          {
            auth: false,
            headers: scanHeaders(token),
          },
        );
        patch(res.found ? { status: "found", name: res.name, price: res.salePrice } : { status: "missing" });
        feedback(res.found);
      } catch (err) {
        if (handleError(err)) patch({ status: "error", message: "Not sent" });
        else patch({ status: "error", message: errorMessage(err) });
        feedback(false);
      }
    },
    [sessionId, token, handleError],
  );

  const onManual = (e: FormEvent) => {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    setManual("");
    void send(code);
  };

  if (phase.kind === "ended" || phase.kind === "invalid") {
    return (
      <Screen>
        <div className="mx-auto mt-16 max-w-sm rounded-card bg-surface p-6 text-center shadow-sm">
          <XCircle className="mx-auto size-10 text-danger" />
          <h1 className="mt-3 text-card font-semibold text-ink">
            {phase.kind === "ended" ? "Phone scanner stopped" : "Can't connect"}
          </h1>
          <p className="mt-2 text-body text-slate">{phase.message}</p>
          <p className="mt-4 text-helper text-muted">
            On the counter PC, open POS billing and click <strong>Scan with phone</strong> to get a new QR code.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <header className="flex items-center gap-2 bg-navy-900 px-4 py-3 text-white">
        <ScanBarcode className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-body font-semibold">Phone scanner</p>
          <p className="truncate text-helper text-white/70">
            {info ? `Connected to ${info.shopName} · ${info.branchName}` : "Connecting…"}
          </p>
        </div>
      </header>

      {phase.kind === "connecting" ? (
        <div className="grid flex-1 place-items-center">
          <Loader2 className="size-8 animate-spin text-muted" aria-label="Connecting" />
        </div>
      ) : (
        <>
          <Camera key={cameraKey} onCode={(code) => void send(code)} onRetry={() => setCameraKey((k) => k + 1)} />

          <form onSubmit={onManual} className="flex gap-2 px-4 pt-3">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="text"
              autoComplete="off"
              placeholder="Or type the barcode / part number"
              aria-label="Barcode or part number"
              className="h-10 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 text-body text-ink outline-none focus:border-navy-600"
            />
            <Button type="submit" variant="outline" disabled={!manual.trim()}>
              Add
            </Button>
          </form>

          <section className="flex-1 px-4 py-3" aria-label="Scanned parts">
            {entries.length === 0 ? (
              <p className="py-6 text-center text-helper text-muted">
                Point the camera at a part's barcode. Each scan is added to the bill on the counter screen.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-card bg-surface">
                {entries.map((e) => (
                  <li key={e.key} className="flex items-center gap-3 px-3 py-2.5">
                    <EntryIcon status={e.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">
                        {e.status === "found" ? e.name : e.code}
                      </p>
                      <p className="truncate text-helper text-muted">
                        {e.status === "found"
                          ? `${e.code}${e.price ? ` · ${formatINR(e.price, { exact: true })}` : ""}`
                          : e.status === "missing"
                            ? "No part has this barcode"
                            : e.status === "error"
                              ? e.message
                              : "Sending…"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-canvas">{children}</div>;
}

function EntryIcon({ status }: { status: Entry["status"] }) {
  if (status === "found") return <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Added" />;
  if (status === "sending") return <Loader2 className="size-5 shrink-0 animate-spin text-muted" aria-label="Sending" />;
  return <AlertTriangle className="size-5 shrink-0 text-danger" aria-label="Not added" />;
}

// ---------- Camera ----------

type CameraState = { kind: "starting" } | { kind: "on" } | { kind: "error"; message: string };

// The camera only works on https (or localhost) in browsers that have it.
const cameraAvailable = () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

function Camera({ onCode, onRetry }: { onCode: (code: string) => void; onRetry: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>(() =>
    cameraAvailable()
      ? { kind: "starting" }
      : { kind: "error", message: "The camera only works on a secure (https) link. Type the barcode below instead." },
  );
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });
  const last = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || !cameraAvailable()) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let stopDecoder: () => void = () => {};

    const found = (code: string) => {
      const now = Date.now();
      if (last.current && last.current.code === code && now - last.current.at < REPEAT_MS) {
        last.current.at = now;
        return;
      }
      last.current = { code, at: now };
      onCodeRef.current(code);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) return;
        el.srcObject = stream;
        await el.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch({ supported: Boolean(caps.torch), on: false });
        setState({ kind: "on" });

        const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        const nativeFormats = Native?.getSupportedFormats ? await Native.getSupportedFormats().catch(() => []) : [];
        const formats = FORMATS.filter((f) => nativeFormats.includes(f));
        if (Native && formats.length) {
          const detector = new Native({ formats });
          let timer: ReturnType<typeof setTimeout> | undefined;
          const loop = async () => {
            if (stopped) return;
            try {
              if (el.readyState >= 2) {
                const codes = await detector.detect(el);
                const value = codes[0]?.rawValue?.trim();
                if (value) found(value);
              }
            } catch {
              // A frame that couldn't be read; try the next one.
            }
            timer = setTimeout(() => void loop(), 150);
          };
          void loop();
          stopDecoder = () => clearTimeout(timer);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) return;
          const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
          const controls = await reader.decodeFromVideoElement(el, (result) => {
            const value = result?.getText().trim();
            if (value) found(value);
          });
          stopDecoder = () => controls.stop();
        }
      } catch (err) {
        if (stopped) return;
        const name = (err as Error).name;
        setState({
          kind: "error",
          message:
            name === "NotAllowedError"
              ? "Camera permission was refused. Allow the camera for this site in the browser settings, then tap Try again."
              : name === "NotFoundError"
                ? "No camera found on this device. Type the barcode below instead."
                : "Couldn't start the camera. Close other apps using it and tap Try again.",
        });
      }
    })();

    return () => {
      stopped = true;
      stopDecoder();
      stream?.getTracks().forEach((t) => t.stop());
      el.srcObject = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = (video.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  return (
    <div className="relative mx-4 mt-3 aspect-[4/3] overflow-hidden rounded-card bg-navy-900">
      <video ref={video} className="size-full object-cover" playsInline muted autoPlay />
      {state.kind === "on" && (
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-input border-2 border-white/80" />
      )}
      {state.kind === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-white/80">
          <Loader2 className="size-8 animate-spin" aria-label="Starting the camera" />
        </div>
      )}
      {state.kind === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-body text-white">
          <p>{state.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      {state.kind === "on" && torch.supported && (
        <button
          type="button"
          onClick={() => void toggleTorch()}
          className={`absolute right-3 bottom-3 grid size-10 place-items-center rounded-full ${torch.on ? "bg-white text-navy-900" : "bg-black/50 text-white"}`}
          aria-label={torch.on ? "Turn the light off" : "Turn the light on"}
          aria-pressed={torch.on}
        >
          <Flashlight className="size-5" />
        </button>
      )}
    </div>
  );
}

// ---------- Beep and buzz ----------

let audio: AudioContext | null = null;

function feedback(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
  } catch {
    // Not supported (iPhone).
  }
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = ok ? 1200 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (ok ? 0.09 : 0.25));
  } catch {
    // No audio: the list still shows the result.
  }
}
