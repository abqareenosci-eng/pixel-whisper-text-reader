import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Download, AlertCircle, Share2, Check } from 'lucide-react';

/** Link a business can open to verify this traveler (fills the code into Scan & Verify). */
export function identityShareLink(token: string): string {
  return `${window.location.origin}/business/scan?token=${encodeURIComponent(token)}`;
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: 'image/png' });
}

export function QRCodeCard({ token, size = 200, shareName }: { token: string; size?: number; shareName?: string }) {
  const [src, setSrc] = useState<string>('');
  const [failed, setFailed] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc('');
    setFailed(false);
    QRCode.toDataURL(token, {
      width: size * 2,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#11302e', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [token, size]);

  useEffect(() => {
    if (!shareNote) return;
    const t = setTimeout(() => setShareNote(null), 3500);
    return () => clearTimeout(t);
  }, [shareNote]);

  const fileName = `identity-qr-${token.slice(0, 8)}.png`;

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName;
    link.click();
  };

  const handleShare = async () => {
    if (!src) return;
    const url = identityShareLink(token);
    const title = 'My ST&ID travel identity';
    const text = `${shareName ? `${shareName} — ` : ''}my ST&ID travel identity. Show this QR code at check-in, or open the link to verify me.`;
    try {
      if (navigator.share) {
        const file = await dataUrlToFile(src, fileName).catch(() => null);
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title, text: `${text}\n${url}`, files: [file] });
        } else {
          await navigator.share({ title, text, url });
        }
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareNote('Sharing is not available here, so the link was copied.');
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // user closed the share sheet
      try {
        await navigator.clipboard.writeText(url);
        setShareNote('Link copied — paste it into WhatsApp or email.');
      } catch {
        setShareNote('Could not open sharing. Use Download QR instead.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      {failed ? (
        <div style={{ width: size, height: size }} className="rounded-2xl bg-white flex flex-col items-center justify-center gap-2 text-center p-4">
          <AlertCircle size={24} className="text-red-500" />
          <p className="text-sm text-navy-700 font-medium">Could not generate QR code</p>
        </div>
      ) : src ? (
        <div className="p-3 bg-white rounded-2xl border border-navy-100 shadow-sm transition-transform duration-300 hover:scale-[1.02]">
          <img src={src} alt="QR Code" width={size} height={size} className="rounded-lg" />
        </div>
      ) : (
        <div style={{ width: size, height: size }} className="rounded-2xl shimmer-bg" />
      )}
      <p className="text-xs text-navy-400 mt-3 font-mono break-all max-w-[200px] text-center">{token}</p>
      {src && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {shareName !== undefined && (
            <button onClick={handleShare} className="btn-primary text-sm py-2">
              <Share2 size={14} />
              Share My ID
            </button>
          )}
          <button onClick={handleDownload} className="btn-secondary text-sm py-2">
            <Download size={14} />
            Download QR
          </button>
        </div>
      )}
      {shareNote && (
        <p role="status" className="mt-2 inline-flex items-center gap-1.5 text-xs text-turquoise-300">
          <Check size={12} />
          {shareNote}
        </p>
      )}
    </div>
  );
}
