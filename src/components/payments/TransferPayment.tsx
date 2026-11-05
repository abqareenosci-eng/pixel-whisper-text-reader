import { useRef, useState, type DragEvent } from 'react';
import { Copy, Check, Upload, Loader2, ImageUp, Sparkles, AlertTriangle, FileText, X } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image';
import { readPaymentReceipt } from '@/lib/receipt.functions';
import { formatAmount, PAYMENT_METHOD_LABELS } from '@/lib/payment';
import type { Booking } from '@/types';

type TransferMethod = 'instapay' | 'vodafone_cash';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-navy-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-navy-500">{label}</p>
        <p className="font-mono text-sm font-semibold text-navy-900 truncate">{value}</p>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}
        className="p-2 rounded-lg hover:bg-navy-100 text-navy-600"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}

export function TransferPayment({ booking, method, onSubmitted, onError }: {
  booking: Booking;
  method: TransferMethod;
  onSubmitted: (booking: Booking) => void;
  onError: (message: string) => void;
}) {
  const readReceipt = useServerFn(readPaymentReceipt);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [reference, setReference] = useState(booking.payment_status === 'rejected' ? '' : booking.payment_reference || '');
  const [reading, setReading] = useState(false);
  const [readAmount, setReadAmount] = useState<number | null>(null);
  const [aiNote, setAiNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const biz = booking.business;
  const payee = method === 'instapay' ? biz?.instapay_address : biz?.vodafone_cash_number;
  const amount = Number(booking.amount || 0);

  const pick = async (f: File | null) => {
    setAiNote('');
    setReadAmount(null);
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return onError('Use a screenshot (JPG, PNG, WebP) or a PDF receipt.');
    if (f.size > 5 * 1024 * 1024) return onError('The receipt must be 5 MB or smaller.');
    setFile(f);
    if (f.type === 'application/pdf') { setPreview(''); return; }
    setPreview(URL.createObjectURL(f));
    // Let Lovable AI read the reference number and amount for the traveler.
    setReading(true);
    try {
      const { dataUrl } = await compressImage(f, 1400, 0.85);
      const res = await readReceipt({ data: { image: dataUrl } });
      if (res.ok && res.isReceipt) {
        if (res.reference) setReference(res.reference);
        setReadAmount(res.amount);
        setAiNote(res.reference ? 'We filled in the reference from your screenshot. Please check it.' : 'We could not find a reference number. Please type it.');
      } else if (res.ok) {
        setAiNote('This does not look like a payment receipt. Make sure you picked the right screenshot.');
      }
    } catch {
      /* typing the reference manually still works */
    } finally {
      setReading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files?.[0] ?? null);
  };

  const clearFile = () => { setFile(null); setPreview(''); setReadAmount(null); setAiNote(''); if (inputRef.current) inputRef.current.value = ''; };

  const submit = async () => {
    if (!file) return onError('Add the screenshot of your transfer.');
    if (reference.trim().length < 4) return onError('Enter the transaction reference from your receipt.');
    setSaving(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${booking.traveler_user_id}/${booking.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setSaving(false); return onError(`Could not upload the receipt: ${uploadError.message}`); }
    const { error } = await supabase.rpc('submit_booking_payment', { _booking_id: booking.id, _method: method, _reference: reference.trim(), _proof_path: path });
    setSaving(false);
    if (error) { await supabase.storage.from('payment-proofs').remove([path]); return onError(error.message); }
    onSubmitted({ ...booking, payment_method: method, payment_reference: reference.trim(), payment_proof_path: path, payment_status: 'pending_review', payment_submitted_at: new Date().toISOString(), payment_rejection_reason: null });
  };

  const amountMismatch = readAmount !== null && amount > 0 && Math.abs(readAmount - amount) > 0.5;

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow text-navy-500 mb-2">Step 1 · Send the money</p>
        {payee ? (
          <div className="grid sm:grid-cols-2 gap-2">
            <CopyField label={method === 'instapay' ? 'InstaPay address' : 'Vodafone Cash number'} value={payee} />
            <CopyField label="Exact amount (EGP)" value={amount ? amount.toFixed(2) : '—'} />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-navy-50 p-3 text-sm text-navy-600">
            {biz?.business_name || 'The business'} has not added a {PAYMENT_METHOD_LABELS[method]} number yet. Send {formatAmount(amount, booking.currency)} using the details they gave you.
          </p>
        )}
        {biz?.payment_instructions && <p className="text-xs text-navy-500 mt-2">{biz.payment_instructions}</p>}
      </div>

      <div>
        <p className="eyebrow text-navy-500 mb-2">Step 2 · Add your receipt</p>
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`w-full rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-turquoise-500 bg-turquoise-50' : 'border-border hover:border-turquoise-400 hover:bg-navy-50'}`}
          >
            <ImageUp size={26} className="mx-auto text-turquoise-700" />
            <p className="font-medium text-navy-900 mt-2">Tap to add the screenshot</p>
            <p className="text-xs text-navy-500 mt-0.5">or drag it here · JPG, PNG or PDF up to 5 MB</p>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
            {preview ? <img src={preview} alt="Receipt preview" className="w-16 h-16 rounded-lg object-cover border border-border" /> : <div className="w-16 h-16 rounded-lg bg-navy-100 flex items-center justify-center"><FileText size={22} className="text-navy-500" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-900 truncate">{file.name}</p>
              {reading ? (
                <p className="text-xs text-turquoise-700 flex items-center gap-1.5 mt-1"><Loader2 size={12} className="animate-spin" />Reading your receipt...</p>
              ) : aiNote ? (
                <p className="text-xs text-navy-500 flex items-center gap-1.5 mt-1"><Sparkles size={12} className="text-accent-600" />{aiNote}</p>
              ) : null}
            </div>
            <button type="button" onClick={clearFile} aria-label="Remove receipt" className="p-2 rounded-lg hover:bg-navy-100 text-navy-500"><X size={16} /></button>
          </div>
        )}
        <input ref={inputRef} type="file" className="hidden" accept={ALLOWED.join(',')} onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
        {amountMismatch && (
          <p className="mt-2 text-xs text-accent-800 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />The receipt shows {formatAmount(readAmount, 'EGP')} but the booking is {formatAmount(amount, 'EGP')}. The business may reject it.</p>
        )}
      </div>

      <div>
        <label className="label">Transaction reference</label>
        <input className="input font-mono" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="From your receipt" />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-navy-500">{biz?.business_name || 'The business'} checks your receipt and confirms the booking.</p>
        <button type="button" disabled={saving || reading} onClick={submit} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {saving ? 'Sending...' : 'Send receipt'}
        </button>
      </div>
    </div>
  );
}
