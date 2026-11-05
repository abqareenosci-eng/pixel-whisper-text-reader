import { createFileRoute } from '@tanstack/react-router';

// Fawry calls this when a payment code changes status (paid, expired...).
// The body is only used to find the booking; the real status is always re-read from Fawry's API.
export const Route = createFileRoute('/api/public/fawry/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let merchantRef = '';
        try {
          const body = (await request.json()) as Record<string, unknown>;
          merchantRef = String(body?.merchantRefNumber ?? body?.merchantRefNum ?? '').trim();
        } catch {
          return new Response('Bad request', { status: 400 });
        }
        if (!/^[A-Za-z0-9_-]{4,64}$/.test(merchantRef)) return new Response('Bad request', { status: 400 });

        const { getFawryConfig, syncBookingWithFawry } = await import('@/lib/fawry.server');
        const cfg = getFawryConfig();
        if (!cfg) return new Response('Not configured', { status: 503 });

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, amount, fawry_merchant_ref')
          .eq('fawry_merchant_ref', merchantRef)
          .maybeSingle();
        if (booking) await syncBookingWithFawry(cfg, booking);
        return new Response('ok');
      },
    },
  },
});
