import { redirect } from 'next/navigation';

export default function RiskRedirect({ searchParams }) {
  const query = new URLSearchParams(searchParams || {}).toString();
  redirect(query ? `/heatmap?${query}` : '/heatmap');
}
