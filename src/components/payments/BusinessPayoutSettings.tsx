import { useEffect, useState } from 'react';
import { Smartphone, Wallet, Save, Loader2, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';

/** Where travelers send InstaPay / Vodafone Cash payments for this business. */
export function BusinessPayoutSettings({ userId, onToast }: { userId: string; onToast: (message: string, type: 'success' | 'error') => void }) {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [instapay, setInstapay] = useState('');
  const [vodafone, setVodafone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('businesses').select('id, instapay_address, vodafone_cash_number, payment_instructions').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setBusinessId(data.id);
      setInstapay(data.instapay_address || '');
      setVodafone(data.vodafone_cash_number || '');
      setNotes(data.payment_instructions || '');
    });
  }, [userId]);

  const save = async () => {
    if (!businessId) return;
    const v = vodafone.replace(/[\s-]/g, '');
    if (v && !/^01[0125]\d{8}$/.test(v)) return onToast('Vodafone Cash number should look like 01012345678.', 'error');
    setSaving(true);
    const { error } = await supabase.from('businesses').update({
      instapay_address: instapay.trim() || null,
      vodafone_cash_number: v || null,
      payment_instructions: notes.trim() || null,
    }).eq('id', businessId);
    setSaving(false);
    if (error) onToast(error.message, 'error');
    else onToast('Payment details saved. Travelers will see them when paying.', 'success');
  };

  if (!businessId) return null;

  return (
    <Card>
      <h2 className="text-lg font-bold text-navy-900">How travelers pay you</h2>
      <p className="text-sm text-navy-500 mt-1 mb-5">Travelers see these details with a copy button when they pay a booking.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">InstaPay address</label>
          <div className="relative">
            <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
            <input className="input pl-11" value={instapay} onChange={(e) => setInstapay(e.target.value)} placeholder="yourname@instapay" />
          </div>
        </div>
        <div>
          <label className="label">Vodafone Cash number</label>
          <div className="relative">
            <Wallet size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
            <input className="input pl-11 font-mono" inputMode="tel" value={vodafone} onChange={(e) => setVodafone(e.target.value)} placeholder="01012345678" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Note for travelers (optional)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Write your booking reference in the transfer note" />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-navy-50 p-3 text-xs text-navy-600">
        <Ticket size={14} className="mt-0.5 text-accent-600 flex-shrink-0" />
        Fawry code payments need no setup from you. They are confirmed automatically.
      </div>
      <div className="flex justify-end mt-5">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save payment details
        </button>
      </div>
    </Card>
  );
}
