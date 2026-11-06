// Document types a traveler can scan, plus helpers shared by the browser and the server.

export type DocumentType = 'passport' | 'national_id' | 'id_card';

export interface DocumentTypeInfo {
  id: DocumentType;
  label: string;
  description: string;
  numberLabel: string;
  tip: string;
}

export const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    id: 'passport',
    label: 'Passport',
    description: 'The photo page with the two lines of code at the bottom.',
    numberLabel: 'Passport Number',
    tip: 'Lay the passport flat in good light so the two lines of code at the bottom are sharp.',
  },
  {
    id: 'national_id',
    label: 'National ID',
    description: 'Egyptian or Iraqi national ID card — the front side with your photo.',
    numberLabel: 'National ID Number',
    tip: 'Photograph the front of the card. Make sure the long ID number is fully visible and not covered by glare.',
  },
  {
    id: 'id_card',
    label: 'Identification Card',
    description: 'Residence permit or other ID card, ideally the side with three lines of code.',
    numberLabel: 'Card Number',
    tip: 'If your card has three lines of code on the back, photograph that side — it gives the most accurate result.',
  },
];

export function isDocumentType(value: unknown): value is DocumentType {
  return value === 'passport' || value === 'national_id' || value === 'id_card';
}

export function getDocumentType(value: string | null | undefined): DocumentTypeInfo {
  return DOCUMENT_TYPES.find((d) => d.id === value) ?? DOCUMENT_TYPES[0];
}

export function documentNumberLabel(value: string | null | undefined): string {
  return getDocumentType(value).numberLabel;
}

/** Converts Arabic-Indic and Persian digits to 0-9. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const EGYPT_GOVERNORATES: Record<string, string> = {
  '01': 'Cairo', '02': 'Alexandria', '03': 'Port Said', '04': 'Suez',
  '11': 'Damietta', '12': 'Dakahlia', '13': 'Sharqia', '14': 'Qalyubia', '15': 'Kafr El Sheikh',
  '16': 'Gharbia', '17': 'Monufia', '18': 'Beheira', '19': 'Ismailia',
  '21': 'Giza', '22': 'Beni Suef', '23': 'Faiyum', '24': 'Minya', '25': 'Asyut', '26': 'Sohag',
  '27': 'Qena', '28': 'Aswan', '29': 'Luxor',
  '31': 'Red Sea', '32': 'New Valley', '33': 'Matrouh', '34': 'North Sinai', '35': 'South Sinai',
  '88': 'Born abroad',
};

export interface EgyptianNationalId {
  number: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  governorate: string;
}

/**
 * Reads the date of birth, gender and birth governorate encoded in a 14-digit Egyptian national ID.
 * Layout: C YYMMDD GG SSSS K — C=2 for 1900s, 3 for 2000s; the 13th digit is odd for men.
 */
export function parseEgyptianNationalId(raw: string): EgyptianNationalId | null {
  const number = toLatinDigits(raw).replace(/\D/g, '');
  if (!/^[23]\d{13}$/.test(number)) return null;
  const century = number[0] === '2' ? 1900 : 2000;
  const year = century + Number(number.slice(1, 3));
  const month = Number(number.slice(3, 5));
  const day = Number(number.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (date.getTime() > Date.now()) return null;
  const governorate = EGYPT_GOVERNORATES[number.slice(7, 9)];
  if (!governorate) return null;
  const gender = Number(number[12]) % 2 === 1 ? 'M' : 'F';
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { number, date_of_birth: iso, gender, governorate };
}
