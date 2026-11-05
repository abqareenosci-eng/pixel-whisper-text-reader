import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type ReceiptReadResult =
  | { ok: true; isReceipt: boolean; amount: number | null; reference: string; method: 'instapay' | 'vodafone_cash' | 'other' | ''; recipient: string }
  | { ok: false; message: string };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_payment_receipt', 'amount_egp', 'transaction_reference', 'method', 'recipient'],
  properties: {
    is_payment_receipt: { type: 'boolean', description: 'True only if the image is a money transfer / payment confirmation screenshot or receipt.' },
    amount_egp: { type: ['number', 'null'], description: 'Amount transferred as a number (no currency), or null if unreadable.' },
    transaction_reference: { type: 'string', description: 'Transaction / reference / operation number exactly as printed, or empty string.' },
    method: { type: 'string', enum: ['instapay', 'vodafone_cash', 'other', ''], description: 'Which service issued the receipt.' },
    recipient: { type: 'string', description: 'Recipient name, phone or InstaPay address as printed, or empty string.' },
  },
} as const;

/** Reads a transfer screenshot (InstaPay / Vodafone Cash) with Lovable AI to pre-fill the payment form. */
export const readPaymentReceipt = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) => {
    if (!input || typeof input.image !== 'string') throw new Error('Image is required');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image)) throw new Error('Unsupported image format');
    if (input.image.length > 6_000_000) throw new Error('Image is too large');
    return { image: input.image };
  })
  .handler(async ({ data }): Promise<ReceiptReadResult> => {
    const { generateResponse } = await import('@lovable.dev/ai-gateway');
    try {
      const response = await generateResponse({
        model: 'openai/gpt-6-astra',
        reasoning: { effort: 'low' },
        instructions:
          'You read Egyptian payment confirmation screenshots (InstaPay, Vodafone Cash, bank apps). Text may be Arabic or English. Read only what is printed; never invent values.',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Extract the transfer details from this receipt and return JSON.' },
              { type: 'input_image', image_url: data.image, detail: 'high' },
            ],
          },
        ],
        text: { format: { type: 'json_schema', name: 'receipt', strict: true, schema: SCHEMA } },
      });
      const output = (response as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output ?? [];
      const text = output.flatMap((o) => (o.type === 'message' ? o.content ?? [] : [])).find((c) => c.type === 'output_text')?.text;
      if (!text) return { ok: false, message: 'Could not read the receipt.' };
      const parsed = JSON.parse(text) as { is_payment_receipt: boolean; amount_egp: number | null; transaction_reference: string; method: string; recipient: string };
      return {
        ok: true,
        isReceipt: !!parsed.is_payment_receipt,
        amount: typeof parsed.amount_egp === 'number' ? parsed.amount_egp : null,
        reference: (parsed.transaction_reference || '').trim().slice(0, 80),
        method: (['instapay', 'vodafone_cash', 'other'].includes(parsed.method) ? parsed.method : '') as 'instapay' | 'vodafone_cash' | 'other' | '',
        recipient: (parsed.recipient || '').trim().slice(0, 120),
      };
    } catch (error) {
      console.error('Receipt read failed', error);
      return { ok: false, message: 'Could not read the receipt automatically. Please type the reference yourself.' };
    }
  });
