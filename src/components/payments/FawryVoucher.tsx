import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, RefreshCw, Loader2, Store, Smartphone, Clock, Ticket } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { createFawryCode, checkFawryPayment, type FawryVoucher as Voucher } from '@/lib/fawry.functions';
import { formatAmount, formatFawryCode } from '@/lib/payment';
import type { Booking } from '@/types';

function useCountdown(target: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!target || now === null) return '';
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function FawryVoucherPanel({ booking, defaultMobile, configured, onPaid, onError }: {
  booking: Booking;
  defaultMobile: string;
  configured: boolean | null;
  onPaid: () => void;
  onError: (message: string) => void;
}) {
  const createCode = useServerFn(createFawryCode);
  const checkPayment = useServerFn(checkFawryPayment);

  const existing: Voucher | null =
    booking.fawry_reference_number && booking.fawry_expires_at && !['EXPIRED', 'CANCELED', 'FAILED'].includes(booking.fawry_status || '') &&
    new Date(booking.fawry_expires_at).getTime() > Date.now()
      ? { referenceNumber: booking.fawry_reference_number, amount: Number(booking.amount || 0), fees: Number(booking.fawry_fees || 0), expiresAt: booking.fawry_expires_at, status: booking.fawry_status || 'UNPAID' }
      : null;

  const [voucher, setVoucher] = useState<Voucher | null>(existing);
  const [mobile, setMobile] = useState(defaultMobile);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');
  const [checkNote, setCheckNote] = useState('');
  const autoChecks = useRef(0);
  const left = useCountdown(voucher?.expiresAt ?? null);

  useEffect(() => {
    if (!voucher) return;
    QRCode.toDataURL(voucher.referenceNumber, { width: 240, margin: 1, color: { dark: '#11302e', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [voucher]);

  const check = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const res = await checkPayment({ data: { bookingId: booking.id } });
      if (res.paymentStatus === 'paid') { onPaid(); return; }
      if (!silent) {
        if (!res.ok) setCheckNote(res.message || 'Could not check right now.');
        else if (res.fawryStatus === 'EXPIRED') { setCheckNote('This code expired. Get a new one below.'); setVoucher(null); }
        else if (res.fawryStatus === 'PARTIAL') setCheckNote('Fawry received less than the booking amount. Contact the business.');
        else setCheckNote('Not paid yet. It usually shows here within a minute of paying.');
      }
    } catch {
      if (!silent) setCheckNote('Could not check right now.');
    } finally {
      if (!silent) setChecking(false);
    }
  }, [booking.id, checkPayment, onPaid]);

  // Quietly re-check every 30s while the code is on screen (max 20 times).
  useEffect(() => {
    if (!voucher) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || autoChecks.current >= 20) return;
      autoChecks.current += 1;
      void check(true);
    }, 30_000);
    return () => clearInterval(t);
  }, [voucher, check]);

  const generate = async () => {
    setCreating(true);
    setCheckNote('');
    try {
      const res = await createCode({ data: { bookingId: booking.id, mobile } });
      if (res.ok) setVoucher(res.voucher);
      else onError(res.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not create the Fawry code.');
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!voucher) return;
    try { await navigator.clipboard.writeText(voucher.referenceNumber); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  if (!voucher) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-100 text-accent-800 flex items-center justify-center flex-shrink-0"><Ticket size={18} /></div>
          <div>
            <p className="font-semibold text-navy-900">Pay with a Fawry code</p>
            <p className="text-sm text-navy-500">Get a payment code, then pay it in cash at any Fawry outlet, or in the myFawry app, your bank app or wallet. The booking turns paid on its own.</p>
          </div>
        </div>
        {configured === false ? (
          <p className="rounded-xl border border-dashed border-border bg-navy-50 p-3 text-sm text-navy-600">Fawry payments are being set up. For now, pay with InstaPay or Vodafone Cash.</p>
        ) : (
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="label">Mobile number for the code SMS</label>
              <input className="input font-mono" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01012345678" />
            </div>
            <button type="button" onClick={generate} disabled={creating || configured === null} className="btn-primary">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
              {creating ? 'Creating code...' : `Get code for ${formatAmount(booking.amount, booking.currency)}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ticket overflow-hidden" style={{ ['--notch-y' as string]: '58%' }}>
      <div className="bg-night-sky px-5 py-3 flex items-center justify-between">
        <span className="eyebrow text-primary-foreground/80">Fawry pay code</span>
        <span className="flex items-center gap-1.5 text-xs font-mono text-primary-foreground/80"><Clock size={12} />{left === 'expired' ? 'Expired' : left}</span>
      </div>
      <div className="p-5 grid sm:grid-cols-[1fr_auto] gap-5 items-center">
        <div>
          <p className="text-xs text-navy-500">Your code</p>
          <p className="font-mono text-3xl sm:text-4xl font-semibold tracking-wider text-navy-900 mt-1">{formatFawryCode(voucher.referenceNumber)}</p>
          <div className="flex items-baseline gap-2 mt-2 flex-wrap">
            <span className="text-lg font-semibold text-navy-900">{formatAmount(voucher.amount, 'EGP')}</span>
            {voucher.fees > 0 && <span className="text-xs text-navy-500">+ {formatAmount(voucher.fees, 'EGP')} Fawry fee</span>}
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <button type="button" onClick={copy} className="btn-secondary text-sm">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy code'}</button>
            <button type="button" onClick={() => check(false)} disabled={checking} className="btn-primary text-sm">{checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}I have paid, check now</button>
          </div>
          {checkNote && <p className="text-xs text-navy-500 mt-2">{checkNote}</p>}
        </div>
        {qr && <img src={qr} alt="Fawry code QR" className="w-28 h-28 rounded-xl border border-border bg-white p-1 justify-self-center" />}
      </div>
      <div className="perforation mx-5" />
      <div className="p-5 grid sm:grid-cols-2 gap-4 text-sm">
        <div className="flex gap-3">
          <Store size={18} className="text-turquoise-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-navy-900">At a Fawry outlet</p>
            <p className="text-navy-500">Tell the cashier "Pay with Fawry code" (ادفع بكود فوري) and give this number. Keep the paper receipt.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Smartphone size={18} className="text-turquoise-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-navy-900">On your phone</p>
            <p className="text-navy-500">myFawry app, bank apps or wallets: choose "Pay with Fawry code" and enter the number.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
