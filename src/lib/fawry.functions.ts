import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export interface FawryVoucher {
  referenceNumber: string;
  amount: number;
  fees: number;
  expiresAt: string;
  status: string;
}

export type FawryCodeResult =
  | { ok: true; voucher: FawryVoucher }
  | { ok: false; code: 'NOT_CONFIGURED' | 'INVALID' | 'FAILED'; message: string };

export type FawryCheckResult = {
  ok: boolean;
  paymentStatus: string;
  fawryStatus: string | null;
  message?: string;
};

const BOOKING_FIELDS =
  'id, traveler_user_id, amount, currency, status, payment_status, booking_reference, service_type, origin, destination, fawry_merchant_ref, fawry_reference_number, fawry_expires_at, fawry_fees, fawry_status';

/** Tells the UI whether Fawry keys are set and whether it is in test or live mode. */
export const getFawrySetup = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getFawryConfig } = await import('@/lib/fawry.server');
    const cfg = getFawryConfig();
    return { configured: !!cfg, live: cfg?.live ?? false };
  });

/** Creates (or returns the still-valid) Fawry payment code for the traveler's own booking. */
export const createFawryCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; mobile: string }) => {
    if (!input || typeof input.bookingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.bookingId)) throw new Error('Invalid booking');
    const mobile = String(input.mobile || '').replace(/[\s-]/g, '').replace(/^\+?20/, '0');
    if (!/^01[0125]\d{8}$/.test(mobile)) throw new Error('Enter an Egyptian mobile number like 01012345678');
    return { bookingId: input.bookingId, mobile };
  })
  .handler(async ({ data, context }): Promise<FawryCodeResult> => {
    const { getFawryConfig, createPayAtFawryCharge } = await import('@/lib/fawry.server');
    const cfg = getFawryConfig();
    if (!cfg) return { ok: false, code: 'NOT_CONFIGURED', message: 'Fawry payments are not switched on yet. Please use InstaPay or Vodafone Cash for now.' };

    const { data: booking, error } = await context.supabase.from('bookings').select(BOOKING_FIELDS).eq('id', data.bookingId).maybeSingle();
    if (error || !booking || booking.traveler_user_id !== context.userId) return { ok: false, code: 'INVALID', message: 'Booking not found.' };
    if (booking.payment_status === 'paid') return { ok: false, code: 'INVALID', message: 'This booking is already paid.' };
    if (booking.payment_status === 'pending_review') return { ok: false, code: 'INVALID', message: 'A receipt for this booking is already being reviewed.' };
    if (booking.status === 'cancelled') return { ok: false, code: 'INVALID', message: 'This booking was cancelled.' };
    const amount = Number(booking.amount);
    if (!amount || amount <= 0) return { ok: false, code: 'INVALID', message: 'The business has not set a price for this booking yet.' };

    // Reuse a code that is still valid for at least 10 more minutes.
    const stillValid =
      booking.fawry_reference_number &&
      booking.fawry_expires_at &&
      new Date(booking.fawry_expires_at).getTime() > Date.now() + 10 * 60 * 1000 &&
      !['EXPIRED', 'CANCELED', 'FAILED'].includes(String(booking.fawry_status || ''));
    if (stillValid) {
      return {
        ok: true,
        voucher: {
          referenceNumber: booking.fawry_reference_number!,
          amount,
          fees: Number(booking.fawry_fees || 0),
          expiresAt: booking.fawry_expires_at!,
          status: booking.fawry_status || 'UNPAID',
        },
      };
    }

    const { data: profile } = await context.supabase.from('profiles').select('full_name').eq('id', context.userId).maybeSingle();
    const email = typeof context.claims?.email === 'string' ? context.claims.email : undefined;
    const merchantRefNum = `ST${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
    const expiresAtMs = Date.now() + 48 * 60 * 60 * 1000;

    let webhookUrl: string | undefined;
    try {
      const origin = new URL(getRequest().url).origin;
      if (origin.startsWith('https://') && !origin.includes('localhost')) webhookUrl = `${origin}/api/public/fawry/webhook`;
    } catch {
      webhookUrl = undefined;
    }

    const route = [booking.origin, booking.destination].filter(Boolean).join(' to ');
    const charge = await createPayAtFawryCharge(cfg, {
      merchantRefNum,
      amount,
      customerName: profile?.full_name || 'ST&ID traveler',
      customerMobile: data.mobile,
      customerEmail: email && !email.endsWith('.test') ? email : undefined,
      customerProfileId: context.userId,
      description: `ST&ID booking ${booking.booking_reference}${route ? ` (${route})` : ''}`.slice(0, 120),
      itemId: booking.booking_reference,
      expiresAtMs,
      webhookUrl,
    });
    if (!charge.ok) return { ok: false, code: 'FAILED', message: charge.message };

    const expiresAt = new Date(charge.expiresAtMs).toISOString();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error: saveError } = await supabaseAdmin.rpc('fawry_attach_voucher', {
      _booking_id: booking.id,
      _merchant_ref: merchantRefNum,
      _reference: charge.referenceNumber,
      _expires_at: expiresAt,
      _fees: charge.fees,
    });
    if (saveError) {
      console.error('Could not save Fawry code', saveError.message);
      return { ok: false, code: 'FAILED', message: 'The payment code was created but could not be saved. Please try again.' };
    }
    return { ok: true, voucher: { referenceNumber: charge.referenceNumber, amount, fees: charge.fees, expiresAt, status: 'UNPAID' } };
  });

/** Asks Fawry whether the booking's code was paid. Callable by the traveler or the booking's business. */
export const checkFawryPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input || typeof input.bookingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.bookingId)) throw new Error('Invalid booking');
    return { bookingId: input.bookingId };
  })
  .handler(async ({ data, context }): Promise<FawryCheckResult> => {
    // RLS: only the traveler, the booking's business or an admin can read the row.
    const { data: booking } = await context.supabase.from('bookings').select(BOOKING_FIELDS).eq('id', data.bookingId).maybeSingle();
    if (!booking) return { ok: false, paymentStatus: 'unknown', fawryStatus: null, message: 'Booking not found.' };
    if (booking.payment_status === 'paid' || !booking.fawry_merchant_ref) {
      return { ok: true, paymentStatus: booking.payment_status, fawryStatus: booking.fawry_status };
    }
    const { getFawryConfig, syncBookingWithFawry } = await import('@/lib/fawry.server');
    const cfg = getFawryConfig();
    if (!cfg) return { ok: false, paymentStatus: booking.payment_status, fawryStatus: booking.fawry_status, message: 'Fawry is not connected.' };
    const status = await syncBookingWithFawry(cfg, booking);
    if (!status) return { ok: false, paymentStatus: booking.payment_status, fawryStatus: booking.fawry_status, message: 'Could not reach Fawry. Try again shortly.' };
    return { ok: true, paymentStatus: status.orderStatus === 'PAID' ? 'paid' : booking.payment_status, fawryStatus: status.orderStatus };
  });
