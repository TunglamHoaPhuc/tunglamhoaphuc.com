// Every address that matches no page lands here. Before giving up the redirect table is asked once (only when V3 reads
// from D1): an address the admin moved answers with its redirect instead of a 404.
import { notFoundOrMoved } from '@/lib/v3-redirect';

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export default async function Missing({ params }: { params: Promise<{ missing?: string[] }> }) {
  const segments = (await params)?.missing ?? [];
  await notFoundOrMoved(`/${segments.map(decode).join('/')}`);
}
