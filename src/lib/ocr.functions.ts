import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { parsePassportText } from '@/lib/mrz';

export type OcrResponse =
  | { ok: true; data: Record<string, string | number>; confidence: number }
  | { ok: false; code: 'BAD_IMAGE' | 'NO_TEXT' | 'FAILED' | 'BUSY' | 'CREDITS'; message: string };

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as a data URL

const FIELD_KEYS = [
  'full_name',
  'nationality',
  'passport_number',
  'passport_type',
  'date_of_birth',
  'gender',
  'place_of_birth',
  'issue_date',
  'expiry_date',
  'issuing_country',
  'mrz_line_1',
  'mrz_line_2',
] as const;

const PASSPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_passport', ...FIELD_KEYS],
  properties: {
    is_passport: { type: 'boolean', description: 'True only if the image shows a passport or travel-document data page.' },
    full_name: { type: 'string', description: 'Given names followed by surname, as printed. Empty string if unreadable.' },
    nationality: { type: 'string', description: 'Nationality as the 3-letter ISO code (e.g. EGY, ITA). Empty string if unreadable.' },
    passport_number: { type: 'string', description: 'Passport / document number. Empty string if unreadable.' },
    passport_type: { type: 'string', description: 'Document type code, usually P. Empty string if unreadable.' },
    date_of_birth: { type: 'string', description: 'YYYY-MM-DD or empty string.' },
    gender: { type: 'string', description: 'M, F, or empty string.' },
    place_of_birth: { type: 'string', description: 'Place of birth as printed, or empty string.' },
    issue_date: { type: 'string', description: 'YYYY-MM-DD or empty string.' },
    expiry_date: { type: 'string', description: 'YYYY-MM-DD or empty string.' },
    issuing_country: { type: 'string', description: 'Issuing state as 3-letter ISO code, or empty string.' },
    mrz_line_1: { type: 'string', description: 'First machine-readable line (44 chars, using <), exactly as printed, or empty string.' },
    mrz_line_2: { type: 'string', description: 'Second machine-readable line (44 chars, using <), exactly as printed, or empty string.' },
  },
} as const;

type Extracted = Record<(typeof FIELD_KEYS)[number], string> & { is_passport: boolean };

function readOutputText(response: unknown): string {
  const output = (response as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output;
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

/** Reads a passport photo with Lovable AI. Only signed-in users can call it. */
export const extractPassport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) => {
    if (!input || typeof input.image !== 'string') throw new Error('Image is required');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image)) throw new Error('Unsupported image format');
    if (input.image.length > MAX_IMAGE_CHARS) throw new Error('Image is too large');
    return { image: input.image };
  })
  .handler(async ({ data }): Promise<OcrResponse> => {
    const { generateResponse, GatewayError, RateLimitError, PaymentRequiredError } = await import('@lovable.dev/ai-gateway');
    try {
      const response = await generateResponse({
        model: 'openai/gpt-6-astra',
        reasoning: { effort: 'low' },
        instructions:
          'You extract data from passport data pages for an identity app. Read only what is printed. Never guess or invent values; use an empty string for anything unreadable. Convert all dates to YYYY-MM-DD.',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Extract the passport fields from this image and return JSON.' },
              { type: 'input_image', image_url: data.image, detail: 'high' },
            ],
          },
        ],
        text: { format: { type: 'json_schema', name: 'passport', strict: true, schema: PASSPORT_SCHEMA } },
      });

      const text = readOutputText(response);
      if (!text) return { ok: false, code: 'NO_TEXT', message: 'We could not read this photo. Try a clearer, well-lit picture of the photo page.' };
      const extracted = JSON.parse(text) as Extracted;
      if (!extracted.is_passport) {
        return { ok: false, code: 'NO_TEXT', message: 'This does not look like a passport photo page. Please upload the page with your photo and the two lines of code at the bottom.' };
      }

      const result: Record<string, string | number> = {};
      for (const key of FIELD_KEYS) {
        if (key.startsWith('mrz_')) continue;
        const value = (extracted[key] || '').trim();
        if (value) result[key] = value;
      }
      result.document_type = 'passport';

      // Cross-check with the MRZ check digits: when they pass, trust the MRZ values.
      let confidence = 0.75;
      const mrz = [extracted.mrz_line_1, extracted.mrz_line_2].filter(Boolean).join('\n');
      if (mrz) {
        const parsed = parsePassportText(mrz);
        const checks = Number(parsed.mrz_checks_passed || 0);
        if (checks === 3) {
          for (const key of ['passport_number', 'nationality', 'date_of_birth', 'expiry_date', 'gender', 'issuing_country'] as const) {
            const v = parsed[key];
            if (typeof v === 'string' && v) result[key] = v;
          }
          if (!result.full_name && typeof parsed.full_name === 'string') result.full_name = parsed.full_name;
          confidence = 0.95;
        } else if (checks >= 2) {
          confidence = 0.85;
        }
      }

      return { ok: true, data: result, confidence };
    } catch (error) {
      if (error instanceof RateLimitError) {
        return { ok: false, code: 'BUSY', message: 'The passport reader is busy right now. Please wait a moment and try again.' };
      }
      if (error instanceof PaymentRequiredError) {
        return { ok: false, code: 'CREDITS', message: 'Passport reading is temporarily unavailable. Please enter your details manually.' };
      }
      if (error instanceof GatewayError) {
        console.error('Passport OCR gateway error', error.code, error.httpStatus, error.ids);
      } else {
        console.error('Passport OCR failed', error);
      }
      return { ok: false, code: 'FAILED', message: 'We could not read this photo. Please try again or enter your details manually.' };
    }
  });
