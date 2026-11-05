import type { Booking, PaymentMethod, PaymentStatus } from '@/types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  instapay: 'InstaPay',
  vodafone_cash: 'Vodafone Cash',
  fawry: 'Fawry',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Not paid yet',
  pending_review: 'Receipt under review',
  paid: 'Paid',
  rejected: 'Receipt rejected',
  refunded: 'Refunded',
};

export const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
  unpaid: 'bg-navy-100 text-navy-600',
  pending_review: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  refunded: 'bg-blue-100 text-blue-700',
};

export function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `${new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency || 'EGP'}`;
}

export function isBookingPaid(booking: Pick<Booking, 'payment_status'>): boolean {
  return booking.payment_status === 'paid';
}

/** Groups a Fawry reference number into blocks of 3 for easy reading at the counter. */
export function formatFawryCode(code: string): string {
  return code.replace(/\s+/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');
}
