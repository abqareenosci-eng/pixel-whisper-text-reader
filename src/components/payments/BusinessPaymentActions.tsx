import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ExternalLink, CheckCircle2, XCircle, RefreshCw, Loader2, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { checkFawryPayment } from '@/lib/fawry.functions';
import { formatFawryCode, PAYMENT_METHOD_LABELS } from '@/lib/payment';
import type { Booking } from '@/types';

/** Receipt review and Fawry status for one booking, shown to the business that owns it. */
export function BusinessPaymentActions({ booking, onUpdated, onToast }: {
  booking: Booking;
  onUpdated: (patch: Partial<Booking>) => void;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const checkFawry = useServerFn(checkFawryPayment);
  const [working, setWorking] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const openProof = async () => {
    if (!booking.payment_proof_path) return;
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(booking.payment_proof_path, 120);
    if (error || !data?.signedUrl) return onToast(error?.message || 'Could not open the receipt', 'error');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const review = async (decision: 'paid' | 'rejected') => {
    setWorking(true);
    const { error } = await supabase.rpc('review_booking_payment', { _booking_id: booking.id, _decision: decision, _reason: decision === 'rejected' ? reason.trim() || undefined : undefined });
    setWorking(false);
    if (error) return onToast(error.message, 'error');
    setRejecting(false);
    onUpdated(decision === 'paid'
      ? { payment_status: 'paid', paid_at: new Date().toISOString(), status: booking.status === 'pending' ? 'confirmed' : booking.status }
      : { payment_status: 'rejected', payment_rejection_reason: reason.trim() || null });
    onToast(decision === 'paid' ? 'Payment approved. Booking confirmed.' : 'Receipt rejected. The traveler can send a new one.', 'success');
  };

  const refreshFawry = async () => {
    setWorking(true);
    try {
      const res = await checkFawry({ data: { bookingId: booking.id } });
      if (res.paymentStatus === 'paid') {
        onUpdated({ payment_status: 'paid', payment_method: 'fawry', status: booking.status === 'pending' ? 'confirmed' : booking.status });
        onToast('Fawry confirmed the payment.', 'success');
      } else {
        onToast(res.message || `Fawry status: ${(res.fawryStatus || 'unpaid').toLowerCase()}`, 'info');
      }
    } catch {
      onToast('Could not reach Fawry.', 'error');
    } finally {
      setWorking(false);
    }
  };

  if (booking.payment_status === 'pending_review') {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-amber-800 mr-auto">
            Receipt to check · {booking.payment_method ? PAYMENT_METHOD_LABELS[booking.payment_method] : '—'} · <span className="font-mono">Ref {booking.payment_reference || '—'}</span>
          </span>
          {booking.payment_proof_path && <button type="button" onClick={openProof} className="btn-secondary text-xs"><ExternalLink size={14} />View receipt</button>}
          {!rejecting && <button type="button" disabled={working} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><XCircle size={14} />Reject</button>}
          {!rejecting && <button type="button" disabled={working} onClick={() => review('paid')} className="btn-primary text-xs">{working ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Approve payment</button>}
        </div>
        {rejecting && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input className="input text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell the traveler why (e.g. amount is short)" />
            <button type="button" onClick={() => setRejecting(false)} className="btn-secondary text-xs">Back</button>
            <button type="button" disabled={working} onClick={() => review('rejected')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{working ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}Reject receipt</button>
          </div>
        )}
      </div>
    );
  }

  if (booking.payment_status !== 'paid' && booking.fawry_reference_number) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-navy-600">
        <Ticket size={14} className="text-accent-600" />
        Fawry code <span className="font-mono font-semibold text-navy-800">{formatFawryCode(booking.fawry_reference_number)}</span>
        <span>· {(booking.fawry_status || 'unpaid').toLowerCase()}</span>
        <button type="button" disabled={working} onClick={refreshFawry} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-turquoise-700 hover:bg-turquoise-50 disabled:opacity-50">
          {working ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}Check
        </button>
      </div>
    );
  }

  return null;
}
