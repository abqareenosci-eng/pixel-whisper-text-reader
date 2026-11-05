export type DemoRole = 'traveler' | 'business' | 'admin';

export interface DemoAccount {
  id: string;
  email: string;
  role: DemoRole;
  name: string;
  title: string;
  personality: string;
  highlights: string[];
}

// Admin demo intentionally removed: a public password must never unlock the admin dashboard.
export const DEMO_PASSWORD = 'StidDemo2026!';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'leo',
    email: 'leo.marchetti@demo.stid.test',
    role: 'traveler',
    name: 'Leo Marchetti',
    title: 'The Adventurous Backpacker',
    personality: 'Spontaneous and curious, always planning the next mountain trail.',
    highlights: ['Verified digital ID', 'Upcoming flight and hotel', 'Pending identity mismatch'],
  },
  {
    id: 'hana',
    email: 'hana.sato@demo.stid.test',
    role: 'traveler',
    name: 'Hana Sato',
    title: 'The Meticulous Business Traveler',
    personality: 'Organized and detail-driven, with a history of smooth, completed trips.',
    highlights: ['Verified digital ID', 'Completed flight and hotel', 'Trip history'],
  },
  {
    id: 'skyline',
    email: 'skyline@demo.stid.test',
    role: 'business',
    name: 'Skyline Airways',
    title: 'The Efficient Airline',
    personality: 'Fast, precise, and focused on boarding passengers on time.',
    highlights: ['Verifies travelers at check-in', 'Issues flight bookings', 'Verification history'],
  },
  {
    id: 'serena',
    email: 'serena@demo.stid.test',
    role: 'business',
    name: 'Casa Serena Hotel',
    title: 'The Warm Hospitality Host',
    personality: 'Welcoming and attentive, with a careful eye on every guest arrival.',
    highlights: ['Verifies hotel guests', 'Raises mismatch reports', 'Manages stays'],
  },
  {
    id: 'omar',
    email: 'omar.elsayed@demo.stid.test',
    role: 'traveler',
    name: 'Omar El-Sayed',
    title: 'The Family Trip Planner',
    personality: 'A Cairo engineer taking his family to Baghdad, juggling flights and hotel rooms for four.',
    highlights: ['Egyptian passport on file', 'Flight waiting for InstaPay payment', 'Hotel paid by Vodafone Cash'],
  },
  {
    id: 'mariam',
    email: 'mariam.hassan@demo.stid.test',
    role: 'traveler',
    name: 'Mariam Hassan',
    title: 'The Student Explorer',
    personality: 'An Alexandria university student chasing temples and sunsets on a student budget.',
    highlights: ['Luxor flight payment under review', 'Name-spelling mismatch to fix', 'Egyptian passport on file'],
  },
  {
    id: 'ali',
    email: 'ali.alrubaie@demo.stid.test',
    role: 'traveler',
    name: 'Ali Al-Rubaie',
    title: 'The Frequent Business Flyer',
    personality: 'A Baghdad trader who flies to Cairo often and likes everything settled before he lands.',
    highlights: ['Iraqi passport on file', 'Rejected payment to resend', 'Completed paid flight'],
  },
  {
    id: 'nilehorizon',
    email: 'nilehorizon@demo.stid.test',
    role: 'business',
    name: 'Nile Horizon Air',
    title: 'The Cairo Airline',
    personality: 'Flies Cairo to Luxor and Baghdad, checking every passport before boarding.',
    highlights: ['Bookings with InstaPay payments', 'Gate verifications', 'Open mismatch report'],
  },
  {
    id: 'tigris',
    email: 'tigris@demo.stid.test',
    role: 'business',
    name: 'Tigris Palace Hotel',
    title: 'The Baghdad Riverside Hotel',
    personality: 'Classic Iraqi hospitality on the Tigris, welcoming families and business guests alike.',
    highlights: ['Paid, rejected and unpaid stays', 'Pre-arrival guest checks', 'Vodafone Cash payments'],
  },
];
