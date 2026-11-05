import { useEffect, useState } from 'react';
import { Calendar, Search, Plane, MapPin, Building2, User2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, Spinner, StatusBadge, PageHeader, EmptyState } from '@/components/ui';
import type { Booking } from '@/types';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment';

export function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*, business:businesses(*), traveler:profiles!traveler_user_id(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings(data as Booking[] || []);
        setLoading(false);
      });
  }, []);

  const filtered = bookings.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (paymentFilter !== 'all' && b.payment_status !== paymentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (b.booking_reference || '').toLowerCase().includes(q) ||
        (b.origin || '').toLowerCase().includes(q) ||
        (b.destination || '').toLowerCase().includes(q) ||
        (b.business?.business_name || '').toLowerCase().includes(q) ||
        (b.traveler?.full_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const reviewPayment = async (booking: Booking, decision: 'paid' | 'rejected') => {
    const reason = decision === 'rejected' ? window.prompt('Reason for rejecting this payment (optional):') : null;
    if (decision === 'rejected' && reason === null) return;
    setWorkingId(booking.id);
    const { error } = await supabase.rpc('review_booking_payment', { _booking_id: booking.id, _decision: decision, _reason: reason ?? undefined });
    setWorkingId(null);
    if (error) { window.alert(error.message); return; }
    setBookings((prev) => prev.map((item) => item.id === booking.id ? { ...item, payment_status: decision, paid_at: decision === 'paid' ? new Date().toISOString() : null, payment_rejection_reason: decision === 'rejected' ? (reason || null) : null } : item));
  };

  const openProof = async (booking: Booking) => {
    if (!booking.payment_proof_path) return;
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(booking.payment_proof_path, 60);
    if (error || !data?.signedUrl) { window.alert(error?.message || 'Could not open payment proof'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><Spinner size={32} /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="All Bookings" subtitle="Monitor all travel bookings across the platform" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
          <input className="input pl-11" placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input py-2.5 max-w-[180px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input py-2.5 max-w-[200px]" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="all">All Payments</option><option value="unpaid">Unpaid</option><option value="pending_review">Awaiting Review</option><option value="paid">Paid</option><option value="rejected">Rejected</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Calendar} title="No bookings found" /></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center flex-shrink-0">
                  <Plane size={18} className="text-navy-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy-900">{b.origin || '—'} → {b.destination || '—'}</p>
                  <div className="flex items-center gap-3 text-xs text-navy-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1"><Building2 size={12} />{b.business?.business_name || '—'}</span>
                    <span className="flex items-center gap-1"><User2 size={12} />{b.traveler?.full_name || '—'}</span>
                    <span className="flex items-center gap-1"><MapPin size={12} />{b.service_type.replace('_', ' ')}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />{b.start_date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono text-xs text-turquoise-600">{b.booking_reference}</span>
                  <StatusBadge status={b.status} />
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : b.payment_status === 'pending_review' ? 'bg-amber-100 text-amber-700' : b.payment_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-navy-100 text-navy-600'}`}>{b.payment_status.replace('_', ' ')}</span>
                </div>
              </div>
              {b.payment_status === 'pending_review' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3">
                  <span className="text-xs text-navy-500 mr-auto">{b.payment_method ? PAYMENT_METHOD_LABELS[b.payment_method] : '—'} · Ref: {b.payment_reference || '—'}</span>
                  {b.payment_proof_path && <button type="button" onClick={() => openProof(b)} className="btn-secondary text-xs"><ExternalLink size={14} />View proof</button>}
                  <button type="button" disabled={workingId === b.id} onClick={() => reviewPayment(b, 'rejected')} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><XCircle size={14} />Reject</button>
                  <button type="button" disabled={workingId === b.id} onClick={() => reviewPayment(b, 'paid')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 size={14} />Approve payment</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
