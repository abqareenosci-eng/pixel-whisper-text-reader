import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isDocumentType, type DocumentType } from '@/lib/id-documents';
import { applyDocumentChecks, FIELD_KEYS, type Extracted, type FieldKey } from '@/lib/document-checks';

export type OcrResponse =
  | { ok: true; data: Record<string, string | number>; confidence: number }
  | { ok: false; code: 'BAD_IMAGE' | 'NO_TEXT' | 'WRONG_DOCUMENT' | 'FAILED' | 'BUSY' | 'CREDITS'; message: string };

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as a data URL



/** What the AI is told for each document type. */
const DOCUMENT_PROMPTS: Record<DocumentType, { name: string; check: string; fields: Partial<Record<FieldKey, string>>; extra: string }> = {
  passport: {
    name: 'passport',
    check: 'True only if the image shows the data (photo) page of a passport.',
    fields: {
      passport_number: 'Passport number. Empty string if unreadable.',
      passport_type: 'Passport type code, usually P. Empty string if unreadable.',
      mrz_line_1: 'First machine-readable line (44 chars, using <), exactly as printed, or empty string.',
      mrz_line_2: 'Second machine-readable line (44 chars, using <), exactly as printed, or empty string.',
      mrz_line_3: 'Always an empty string for passports.',
    },
    extra: 'Passports have two 44-character machine-readable lines at the bottom.',
  },
  national_id: {
    name: 'national ID card',
    check: 'True only if the image shows a government national ID card (for example an Egyptian or Iraqi national ID).',
    fields: {
      passport_number: 'The national ID number. Egyptian cards have a 14-digit number; convert Arabic digits (٠-٩) to 0-9. Empty string if unreadable.',
      passport_type: 'Always the string NID.',
      place_of_birth: 'Place of birth if printed; otherwise the city/governorate of the address. Empty string if unreadable.',
      nationality: 'Nationality as 3-letter ISO code. Egyptian cards: EGY. Iraqi cards: IRQ.',
      mrz_line_1: 'First machine-readable line if the card has one (30 chars, using <), otherwise empty string.',
      mrz_line_2: 'Second machine-readable line if present, otherwise empty string.',
      mrz_line_3: 'Third machine-readable line if present, otherwise empty string.',
    },
    extra:
      'National ID cards are often printed in Arabic. Write the full name in Latin letters: use the English spelling if printed, otherwise transliterate the Arabic name (e.g. محمد أحمد → Mohamed Ahmed).',
  },
  id_card: {
    name: 'identification card',
    check: 'True only if the image shows an identity card, residence permit or similar official ID card (not a passport page).',
    fields: {
      passport_number: 'Card / document number. Empty string if unreadable.',
      passport_type: 'Document code from the MRZ (e.g. ID, IR, AC) or empty string.',
      mrz_line_1: 'First of the three 30-character machine-readable lines (using <), exactly as printed, or empty string.',
      mrz_line_2: 'Second machine-readable line, or empty string.',
      mrz_line_3: 'Third machine-readable line, or empty string.',
    },
    extra:
      'ID cards often have three 30-character machine-readable lines. If the name is only in Arabic or another script, transliterate it into Latin letters.',
  },
};

function schemaFor(type: DocumentType) {
  const prompt = DOCUMENT_PROMPTS[type];
  const base: Record<FieldKey, string> = {
    full_name: 'Given names followed by surname, in Latin letters. Empty string if unreadable.',
    nationality: 'Nationality as the 3-letter ISO code (e.g. EGY, IRQ). Empty string if unreadable.',
    passport_number: 'Document number. Empty string if unreadable.',
    passport_type: 'Document type code. Empty string if unreadable.',
    date_of_birth: 'YYYY-MM-DD or empty string.',
    gender: 'M, F, or empty string.',
    place_of_birth: 'Place of birth as printed, or empty string.',
    issue_date: 'YYYY-MM-DD or empty string.',
    expiry_date: 'YYYY-MM-DD or empty string.',
    issuing_country: 'Issuing state as 3-letter ISO code, or empty string.',
    mrz_line_1: 'Empty string.',
    mrz_line_2: 'Empty string.',
    mrz_line_3: 'Empty string.',
  };
  const properties: Record<string, { type: string; description: string }> = {
    matches_document: { type: 'boolean', description: prompt.check },
  };
  for (const key of FIELD_KEYS) properties[key] = { type: 'string', description: prompt.fields[key] ?? base[key] };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['matches_document', ...FIELD_KEYS],
    properties,
  };
}


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

const WRONG_DOCUMENT_MESSAGE: Record<DocumentType, string> = {
  passport: 'This does not look like a passport photo page. Upload the page with your photo, or pick a different document type.',
  national_id: 'This does not look like a national ID card. Photograph the front of the card, or pick a different document type.',
  id_card: 'This does not look like an ID card. Photograph the card (the side with the code lines is best), or pick a different document type.',
};

/** Reads a passport, national ID or ID card photo with Lovable AI. Only signed-in users can call it. */
export const extractPassport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string; documentType?: string }) => {
    if (!input || typeof input.image !== 'string') throw new Error('Image is required');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image)) throw new Error('Unsupported image format');
    if (input.image.length > MAX_IMAGE_CHARS) throw new Error('Image is too large');
    const documentType: DocumentType = isDocumentType(input.documentType) ? input.documentType : 'passport';
    return { image: input.image, documentType };
  })
  .handler(async ({ data }): Promise<OcrResponse> => {
    const { generateResponse, GatewayError, RateLimitError, PaymentRequiredError } = await import('@lovable.dev/ai-gateway');
    const prompt = DOCUMENT_PROMPTS[data.documentType];
    try {
      const response = await generateResponse({
        model: 'openai/gpt-6-astra',
        reasoning: { effort: 'low' },
        instructions:
          `You extract data from a ${prompt.name} for an identity app. Read only what is printed. Never guess or invent values; use an empty string for anything unreadable. Convert all dates to YYYY-MM-DD. ${prompt.extra}`,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: `Extract the ${prompt.name} fields from this image and return JSON.` },
              { type: 'input_image', image_url: data.image, detail: 'high' },
            ],
          },
        ],
        text: { format: { type: 'json_schema', name: 'identity_document', strict: true, schema: schemaFor(data.documentType) } },
      });

      const text = readOutputText(response);
      if (!text) return { ok: false, code: 'NO_TEXT', message: 'We could not read this photo. Try a clearer, well-lit picture.' };
      const extracted = JSON.parse(text) as Extracted;
      if (!extracted.matches_document) {
        return { ok: false, code: 'WRONG_DOCUMENT', message: WRONG_DOCUMENT_MESSAGE[data.documentType] };
      }
      const { result, confidence } = applyDocumentChecks(data.documentType, extracted);
      return { ok: true, data: result, confidence };
    } catch (error) {
      if (error instanceof RateLimitError) {
        return { ok: false, code: 'BUSY', message: 'The document reader is busy right now. Please wait a moment and try again.' };
      }
      if (error instanceof PaymentRequiredError) {
        return { ok: false, code: 'CREDITS', message: 'Document reading is temporarily unavailable. Please enter your details manually.' };
      }
      if (error instanceof GatewayError) {
        console.error('Document OCR gateway error', error.code, error.httpStatus, error.ids);
      } else {
        console.error('Document OCR failed', error);
      }
      return { ok: false, code: 'FAILED', message: 'We could not read this photo. Please try again or enter your details manually.' };
    }
  });
