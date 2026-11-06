import { createFileRoute } from '@tanstack/react-router';
import { ProtectedRoute } from '@/components/RouteGuards';
import { TravelerScan } from '@/pages/traveler/TravelerScan';

export const Route = createFileRoute('/traveler/scan')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Scan your ID | ST&ID' },
      { name: 'description', content: 'Scan your ID — ST&ID traveler area.' },
      { property: 'og:title', content: 'Scan your ID | ST&ID' },
      { property: 'og:description', content: 'Scan your ID — ST&ID traveler area.' },
    ],
  }),
  component: () => <ProtectedRoute allowedRoles={['traveler']}><TravelerScan /></ProtectedRoute>,
});
