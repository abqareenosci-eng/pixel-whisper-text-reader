import { useEffect, useState } from 'react';
import { Plane, Calendar, MapPin, Building2, Filter, Search, Upload, Loader2, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, EmptyState, StatusBadge, Spinner, PageHeader, Toast } from '@/components/ui';
import type { Booking, PaymentMethod } from '@/types';
import { formatAmount, PAYMENT_METHOD_LABELS } from '@/lib/payment';

export function TravelerTrips() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('bookings')
      .select('*, business:businesses(*), identity:identities(*)')
      .eq('traveler_user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings(data as Booking[]);
        setLoading(false);
      });
  }, [profile]);

  const filtered = bookings.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.booking_reference.toLowerCase().includes(q) ||
        (b.origin || '').toLowerCase().includes(q) ||
        (b.destination || '').toLowerCase().includes(q) ||
        (b.business?.business_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><Spinner size={32} /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader title="My Trips" subtitle="View and manage all your travel bookings" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            className="input pl-11"
            placeholder="Search by reference, destination, or business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-navy-400" />
          <select className="input py-2.5" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Plane} title="No trips found" description="Your travel bookings will appear here once a business creates one for you." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((booking) => (
            <Card key={booking.id} className="hover:border-turquoise-200 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center flex-shrink-0">
                  <Plane size={20} className="text-navy-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-navy-900 text-lg">
                      {booking.origin || 'Departure'} → {booking.destination || 'Arrival'}
                    </p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-navy-400 mt-2 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} />
                      {booking.business?.business_name || 'Unknown business'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {booking.start_date}{booking.end_date ? ` → ${booking.end_date}` : ''}
                    </span>
                    <span className="capitalize flex items-center gap-1.5">
                      <MapPin size={14} />
                      {booking.service_type.replace('_', ' ')}
                    </span>
                  </div>
                  {booking.notes && <p className="text-sm text-navy-500 mt-2">{booking.notes}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-navy-800">{formatAmount(booking.amount, booking.currency)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${booking.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : booking.payment_status === 'pending_review' ? 'bg-amber-100 text-amber-700' : booking.payment_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-navy-100 text-navy-600'}`}>
                      {booking.payment_status === 'pending_review' ? 'Payment under review' : booking.payment_status.replace('_', ' ')}
                    </span>
                  </div>
                  {booking.payment_status !== 'paid' && booking.status !== 'cancelled' && (
                    <PaymentSubmission booking={booking} onSubmitted={(updated) => setBookings((prev) => prev.map((item) => item.id === updated.id ? updated : item))} onError={(message) => setToast({ message, type: 'error' })} onSuccess={() => setToast({ message: 'Payment proof submitted for review.', type: 'success' })} />
                  )}
                  {booking.payment_rejection_reason && <p className="text-sm text-red-600 mt-2">Payment rejected: {booking.payment_rejection_reason}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-navy-400">Booking Ref</p>
                  <p className="font-mono text-sm text-turquoise-600 font-semibold">{booking.booking_reference}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}


function PaymentSubmission({ booking, onSubmitted, onError, onSuccess }: {
  booking: Booking;
  onSubmitted: (booking: Booking) => void;
  onError: (message: string) => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>(booking.payment_method || 'instapay');
  const [reference, setReference] = useState(booking.payment_reference || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(booking.payment_status === 'rejected');

  const submit = async () => {
    if (!reference.trim() || reference.trim().length < 4) return onError('Enter the transaction reference.');
    if (!file) return onError('Attach a payment screenshot or PDF receipt.');
    if (file.size > 5 * 1024 * 1024) return onError('The proof file must be 5 MB or smaller.');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return onError('Use a JPG, PNG, WebP image, or PDF receipt.');
    setSaving(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${booking.traveler_user_id}/${booking.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setSaving(false); return onError(`Could not upload proof: ${uploadError.message}. Apply the payment workflow migration first.`); }
    const { error: submitError } = await supabase.rpc('submit_booking_payment', {
      _booking_id: booking.id, _method: method, _reference: reference.trim(), _proof_path: path,
    });
    setSaving(false);
    if (submitError) { await supabase.storage.from('payment-proofs').remove([path]); return onError(submitError.message); }
    onSubmitted({ ...booking, payment_method: method, payment_reference: reference.trim(), payment_proof_path: path, payment_status: 'pending_review', payment_submitted_at: new Date().toISOString(), payment_rejection_reason: null });
    setExpanded(false);
    onSuccess();
  };

  if (booking.payment_status === 'pending_review') return <p className="mt-2 text-xs text-amber-700">Your payment proof was submitted. Waiting for admin review.</p>;
  return <div className="mt-3">
    <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-2 text-sm font-semibold text-turquoise-700"><Wallet size={16} />{booking.payment_status === 'rejected' ? 'Resubmit payment proof' : 'Submit payment proof'}</button>
    {expanded && <div className="mt-3 rounded-xl border border-navy-200 bg-white p-4 space-y-3">
      <p className="text-xs text-navy-500">Pay the business using the agreed method, then upload the receipt. Payment is not confirmed until an administrator reviews it.</p>
      <div><label className="label">Payment method</label><select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}><option value="instapay">{PAYMENT_METHOD_LABELS.instapay}</option><option value="vodafone_cash">{PAYMENT_METHOD_LABELS.vodafone_cash}</option></select></div>
      <div><label className="label">Transaction reference</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Enter transfer reference" /></div>
      <div><label className="label">Payment proof (max 5 MB)</label><input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <button type="button" disabled={saving} onClick={submit} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{saving ? 'Submitting...' : 'Submit for review'}</button>
    </div>}
  </div>;
}
