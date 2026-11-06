import { parseIdCardMrz, parsePassportText } from '@/lib/mrz';
import { parseEgyptianNationalId, toLatinDigits, type DocumentType } from '@/lib/id-documents';

export const FIELD_KEYS = [
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
  'mrz_line_3',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
export type Extracted = Record<FieldKey, string> & { matches_document: boolean };

/** Cross-checks the AI result with the document's own check digits and fills in trusted values. */
export function applyDocumentChecks(type: DocumentType, extracted: Extracted): { result: Record<string, string | number>; confidence: number } {
  const result: Record<string, string | number> = {};
  for (const key of FIELD_KEYS) {
    if (key.startsWith('mrz_')) continue;
    const value = (extracted[key] || '').trim();
    if (value) result[key] = value;
  }
  result.document_type = type;
  let confidence = 0.75;

  const mrzText = [extracted.mrz_line_1, extracted.mrz_line_2, extracted.mrz_line_3].filter(Boolean).join('\n');
  const parsed = !mrzText ? null : type === 'passport' ? parsePassportText(mrzText) : parseIdCardMrz(mrzText);
  if (parsed) {
    const checks = Number(parsed.mrz_checks_passed || 0);
    if (checks === 3) {
      for (const key of ['passport_number', 'nationality', 'date_of_birth', 'expiry_date', 'gender', 'issuing_country'] as const) {
        const v = parsed[key];
        if (typeof v === 'string' && v) result[key] = v;
      }
      if (!result.full_name && typeof parsed.full_name === 'string' && parsed.full_name) result.full_name = parsed.full_name;
      confidence = 0.95;
    } else if (checks >= 2) {
      confidence = 0.85;
    }
  }

  if (type === 'national_id') {
    result.passport_type = 'NID';
    const nid = typeof result.passport_number === 'string' ? parseEgyptianNationalId(result.passport_number) : null;
    if (nid) {
      // The Egyptian number itself encodes birth date, gender and birth governorate.
      result.passport_number = nid.number;
      result.date_of_birth = nid.date_of_birth;
      result.gender = nid.gender;
      result.nationality = result.nationality || 'EGY';
      result.issuing_country = result.issuing_country || 'EGY';
      if (!result.place_of_birth) result.place_of_birth = nid.governorate;
      confidence = Math.max(confidence, 0.9);
    } else if (typeof result.passport_number === 'string') {
      result.passport_number = toLatinDigits(result.passport_number).replace(/\s+/g, '');
    }
  }
  return { result, confidence };
}

