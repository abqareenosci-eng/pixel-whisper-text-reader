// Server-only FawryPay helpers ("Pay at Fawry" reference codes).
// Docs: https://developer.fawrystaging.com (charge API + payment status v2).

export interface FawryConfig {
  merchantCode: string;
  secureKey: string;
  baseUrl: string;
  live: boolean;
}

export function getFawryConfig(): FawryConfig | null {
  const merchantCode = process.env['FAWRY_MERCHANT_CODE'];
  const secureKey = process.env['FAWRY_SECURE_KEY'];
  if (!merchantCode || !secureKey) return null;
  const live = (process.env['FAWRY_MODE'] || '').trim().toLowerCase() === 'live';
  return {
    merchantCode: merchantCode.trim(),
    secureKey: secureKey.trim(),
    live,
    baseUrl: live ? 'https://www.atfawry.com' : 'https://atfawry.fawrystaging.com',
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const money = (n: number) => n.toFixed(2);

export interface ChargeInput {
  merchantRefNum: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  customerProfileId: string;
  description: string;
  itemId: string;
  expiresAtMs: number;
  webhookUrl?: string;
}

export type ChargeResult =
  | { ok: true; referenceNumber: string; fees: number; expiresAtMs: number }
  | { ok: false; message: string };

export async function createPayAtFawryCharge(cfg: FawryConfig, input: ChargeInput): Promise<ChargeResult> {
  const paymentMethod = 'PAYATFAWRY';
  const amount = money(input.amount);
  const signature = await sha256Hex(
    cfg.merchantCode + input.merchantRefNum + input.customerProfileId + paymentMethod + amount + cfg.secureKey,
  );
  const body: Record<string, unknown> = {
    merchantCode: cfg.merchantCode,
    merchantRefNum: input.merchantRefNum,
    customerProfileId: input.customerProfileId,
    customerName: input.customerName,
    customerMobile: input.customerMobile,
    ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
    paymentMethod,
    amount: Number(amount),
    currencyCode: 'EGP',
    language: 'en-gb',
    description: input.description,
    paymentExpiry: input.expiresAtMs,
    chargeItems: [{ itemId: input.itemId, description: input.description, price: Number(amount), quantity: 1 }],
    signature,
  };
  if (input.webhookUrl) body.orderWebHookUrl = input.webhookUrl;

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/ECommerceWeb/Fawry/payments/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Fawry charge request failed', error);
    return { ok: false, message: 'Could not reach Fawry. Please try again in a minute.' };
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const statusCode = Number(json?.statusCode ?? res.status);
  const referenceNumber = json?.referenceNumber ? String(json.referenceNumber) : '';
  if (!res.ok || statusCode !== 200 || !referenceNumber) {
    console.error('Fawry charge rejected', res.status, json?.statusCode, json?.statusDescription);
    return { ok: false, message: 'Fawry could not create a payment code right now. Please try again later.' };
  }
  return {
    ok: true,
    referenceNumber,
    fees: Number(json?.fawryFees ?? 0) || 0,
    expiresAtMs: Number(json?.expirationTime ?? input.expiresAtMs) || input.expiresAtMs,
  };
}

export interface FawryStatus {
  orderStatus: string; // PAID | UNPAID | EXPIRED | CANCELED | REFUNDED | FAILED | NEW ...
  referenceNumber: string | null;
  paymentAmount: number | null;
  orderAmount: number | null;
  fees: number | null;
}

export async function getFawryStatus(cfg: FawryConfig, merchantRefNumber: string): Promise<FawryStatus | null> {
  const signature = await sha256Hex(cfg.merchantCode + merchantRefNumber + cfg.secureKey);
  const url = new URL(`${cfg.baseUrl}/ECommerceWeb/Fawry/payments/status/v2`);
  url.searchParams.set('merchantCode', cfg.merchantCode);
  url.searchParams.set('merchantRefNumber', merchantRefNumber);
  url.searchParams.set('signature', signature);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json || Number(json.statusCode ?? 200) !== 200 || !json.orderStatus) {
      console.error('Fawry status lookup failed', res.status, json?.statusCode, json?.statusDescription);
      return null;
    }
    const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v));
    return {
      orderStatus: String(json.orderStatus).toUpperCase(),
      referenceNumber: json.referenceNumber ? String(json.referenceNumber) : null,
      paymentAmount: num(json.paymentAmount),
      orderAmount: num(json.orderAmount),
      fees: num(json.fawryFees),
    };
  } catch (error) {
    console.error('Fawry status request failed', error);
    return null;
  }
}

/**
 * Asks Fawry for the real status of a booking's code and stores it.
 * Never trusts a callback body: the status always comes from Fawry's API.
 */
export async function syncBookingWithFawry(
  cfg: FawryConfig,
  booking: { id: string; amount: number | null; fawry_merchant_ref: string | null },
): Promise<FawryStatus | null> {
  if (!booking.fawry_merchant_ref) return null;
  const status = await getFawryStatus(cfg, booking.fawry_merchant_ref);
  if (!status) return null;

  let applied = status.orderStatus;
  if (applied === 'PAID') {
    const paid = status.orderAmount ?? status.paymentAmount ?? 0;
    if (booking.amount !== null && paid + 0.01 < Number(booking.amount)) {
      console.error('Fawry paid amount lower than booking amount', booking.id, paid, booking.amount);
      applied = 'PARTIAL';
    }
  }

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.rpc('fawry_apply_status', {
    _booking_id: booking.id,
    _status: applied,
    _fawry_reference: status.referenceNumber ?? undefined,
    _fees: status.fees ?? undefined,
  });
  if (error) console.error('Could not store Fawry status', error.message);
  return { ...status, orderStatus: applied };
}
