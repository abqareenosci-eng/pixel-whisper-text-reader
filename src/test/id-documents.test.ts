import { describe, expect, it } from 'vitest';
import { parseEgyptianNationalId, toLatinDigits } from '@/lib/id-documents';
import { parseIdCardMrz } from '@/lib/mrz';
import { applyDocumentChecks, FIELD_KEYS, type Extracted } from '@/lib/document-checks';

function extracted(fields: Partial<Extracted>): Extracted {
  const base = Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])) as unknown as Extracted;
  return { ...base, matches_document: true, ...fields };
}

describe('Egyptian national ID', () => {
  it('reads birth date, gender and governorate from the 14-digit number', () => {
    // 2 = 1900s, 900115 = 15 Jan 1990, 01 = Cairo, 13th digit 3 = male
    expect(parseEgyptianNationalId('29001150101234')).toEqual({ number: '29001150101234', date_of_birth: '1990-01-15', gender: 'M', governorate: 'Cairo' });
  });
  it('treats an even 13th digit as female and century 3 as 2000s', () => {
    expect(parseEgyptianNationalId('30205210200046')).toMatchObject({ date_of_birth: '2002-05-21', gender: 'F', governorate: 'Alexandria' });
  });
  it('accepts Arabic digits', () => {
    expect(toLatinDigits('٢٩٠٠١١٥٠١٠١٢٣٤')).toBe('29001150101234');
    expect(parseEgyptianNationalId('٢٩٠٠١١٥٠١٠١٢٣٤')?.date_of_birth).toBe('1990-01-15');
  });
  it('rejects impossible dates and unknown governorates', () => {
    expect(parseEgyptianNationalId('29013450101234')).toBeNull();
    expect(parseEgyptianNationalId('29001159901234')).toBeNull();
    expect(parseEgyptianNationalId('1234')).toBeNull();
  });
  it('fills date of birth and gender from the number for national IDs', () => {
    const { result } = applyDocumentChecks('national_id', extracted({ full_name: 'Mariam Hassan', passport_number: '30205210200046', gender: 'M' }));
    expect(result).toMatchObject({ document_type: 'national_id', date_of_birth: '2002-05-21', gender: 'F', nationality: 'EGY', passport_type: 'NID' });
  });
});

describe('ID card (3-line) machine-readable zone', () => {
  // ICAO 9303 TD1 specimen
  const td1 = 'I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<';
  it('parses document number, dates and name with check digits', () => {
    const r = parseIdCardMrz(td1);
    expect(r).toMatchObject({ passport_number: 'D23145890', date_of_birth: '1974-08-12', expiry_date: '2012-04-15', gender: 'F', nationality: 'UTO', full_name: 'ANNA MARIA ERIKSSON', mrz_checks_passed: 3 });
  });
  it('trusts the code lines over the AI reading for ID cards', () => {
    const [l1, l2, l3] = td1.split('\n');
    const { result, confidence } = applyDocumentChecks('id_card', extracted({ passport_number: 'D2314589O', mrz_line_1: l1, mrz_line_2: l2, mrz_line_3: l3 }));
    expect(result.passport_number).toBe('D23145890');
    expect(confidence).toBe(0.95);
  });
});
