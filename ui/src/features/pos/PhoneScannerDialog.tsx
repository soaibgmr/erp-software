import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/utils";
import { phoneScanUrl, type PhoneScanner } from "./phone-scanner";

// "Scan with phone": shows a QR code; the phone that opens it becomes a barcode scanner for this POS.
export function PhoneScannerDialog({
  open,
  onClose,
  scanner,
}: {
  open: boolean;
  onClose: () => void;
  scanner: PhoneScanner;
}) {
  const toast = useToast();
  const { session, phoneConnected, starting, start, end } = scanner;
  const [qr, setQr] = useState<string | null>(null);
  const url = session ? phoneScanUrl(session) : null;

  // Opening the dialog pairs a phone straight away (or shows the current pairing again).
  useEffect(() => {
    if (open && !session && !starting) {
      start().catch((err: unknown) => toast({ message: errorMessage(err), tone: "error" }));
    }
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((data) => live && setQr(data))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [url]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan with phone"
      footer={
        <>
          {session && (
            <Button
              variant="danger-outline"
              onClick={() => {
                void end();
                onClose();
              }}
            >
              Stop phone scanner
            </Button>
          )}
          <Button onClick={onClose}>{phoneConnected ? "Done" : "Close"}</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {phoneConnected ? (
          <p className="inline-flex items-center gap-2 rounded-input bg-success-50 px-3 py-2 text-body font-medium text-success">
            <CheckCircle2 className="size-4" /> Phone connected. Scanned parts are added to the bill on this screen.
          </p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-left text-body text-slate">
            <li>Open the camera on your phone and point it at this QR code.</li>
            <li>Open the link it shows and allow the camera.</li>
            <li>Point the phone at a part's barcode. The part is added to the bill on this screen.</li>
          </ol>
        )}
        <div className="grid size-[248px] place-items-center rounded-card border border-border bg-surface">
          {qr ? (
            <img src={qr} alt="QR code to connect your phone" className="size-[240px]" />
          ) : (
            <Loader2 className="size-6 animate-spin text-muted" aria-label="Preparing the QR code" />
          )}
        </div>
        {!phoneConnected && session && (
          <p className="inline-flex items-center gap-2 text-helper text-muted">
            <Smartphone className="size-4" /> Waiting for the phone…
          </p>
        )}
        <p className="text-helper text-muted">
          The phone only needs internet; it doesn't have to be on the same Wi-Fi. The link works for 12 hours or until
          you stop it. One phone per counter: a new QR code stops the old one.
        </p>
      </div>
    </Modal>
  );
}
