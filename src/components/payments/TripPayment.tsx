import { useState } from 'react';
import { Ticket, Smartphone, Wallet, CheckCircle2, Hourglass, ChevronDown } from 'lucide-react';
import { FawryVoucherPanel } from '@/components/payments/FawryVoucher';
import { TransferPayment } from '@/components/payments/TransferPayment';
import { formatAmount, PAYMENT_METHOD_LABELS } from '@/lib/payment';
import type { Booking } from '@/types';

type Tab = 'fawry' | 'instapay' | 'vodafone_cash';
const TABS: { id: Tab; label: string; icon: typeof Ticket }[] = [
  { id: 'fawry', label: 'Fawry code', icon: Ticket },
  { id: 'instapay', label: 'InstaPay', icon: Smartphone },
  { id: 'vodafone_cash', label: 'Vodafone Cash', icon: Wallet },
];

export function TripPayment({ booking, defaultMobile, fawryConfigured, onUpdated, onToast }: {
  booking: Booking;
  defaultMobile: string;
  fawryConfigured: boolean | null;
  onUpdated: (booking: Booking) => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}) {
  const hasCode = !!booking.fawry_reference_number && booking.fawry_status !== 'EXPIRED';
  const initialTab: Tab = hasCode ? 'fawry' : booking.payment_method === 'instapay' || booking.payment_method === 'vodafone_cash' ? booking.payment_method : 'fawry';
  const [open, setOpen] = useState(booking.payment_status === 'rejected' || hasCode);
  const [tab, setTab] = useState<Tab>(initialTab);
  const bizName = booking.business?.business_name || 'the business';

  if (booking.status === 'cancelled') return null;

  if (booking.payment_status === 'paid') {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 size={16} />
        Paid{booking.payment_method ? ` with ${PAYMENT_METHOD_LABELS[booking.payment_method]}` : ''}
        {booking.payment_reference ? <span className="font-mono text-xs text-navy-500">· {booking.payment_reference}</span> : null}
      </p>
    );
  }

  if (booking.payment_status === 'pending_review') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
        <Hourglass size={16} className="mt-0.5 flex-shrink-0" />
        <span>Receipt sent. Waiting for {bizName} to confirm your {booking.payment_method ? PAYMENT_METHOD_LABELS[booking.payment_method] : ''} payment.</span>
      </div>
    );
  }

  if (!booking.amount || Number(booking.amount) <= 0) {
    return <p className="mt-3 text-xs text-navy-500">{bizName} has not set a price yet.</p>;
  }

  const paid = () => {
    onUpdated({ ...booking, payment_status: 'paid', payment_method: 'fawry', payment_reference: booking.fawry_reference_number ?? null, paid_at: new Date().toISOString(), status: booking.status === 'pending' ? 'confirmed' : booking.status });
    onToast('Payment received by Fawry. Your booking is paid.', 'success');
  };

  return (
    <div className="mt-3">
      {booking.payment_status === 'rejected' && booking.payment_rejection_reason && (
        <p className="mb-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">Receipt rejected: {booking.payment_rejection_reason}</p>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn-primary text-sm">
        <Wallet size={16} />
        Pay {formatAmount(booking.amount, booking.currency)}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 space-y-4 animate-fade-in">
          <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-navy-100 p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition-all ${tab === id ? 'bg-card text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-800'}`}
              >
                <Icon size={15} className="hidden sm:block" />{label}
              </button>
            ))}
          </div>
          {tab === 'fawry' ? (
            <FawryVoucherPanel booking={booking} defaultMobile={defaultMobile} configured={fawryConfigured} onPaid={paid} onError={(m) => onToast(m, 'error')} />
          ) : (
            <TransferPayment
              key={tab}
              booking={booking}
              method={tab}
              onError={(m) => onToast(m, 'error')}
              onSubmitted={(updated) => { onUpdated(updated); setOpen(false); onToast(`Receipt sent to ${bizName}.`, 'success'); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
