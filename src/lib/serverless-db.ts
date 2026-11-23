// V3 on www's data: what used to be JSON files on B2 (or /tmp) now comes from www's D1 through
// v3-data.ts, or from the copies bundled in src/data for the sets www does not hold.
// Read only: there is nothing here that writes (edit in www's /quan-tri).
import { allAbout, allAreas, allPostRecords, allTongChi } from './v3-data';
import { liveStatueRecords } from './v3-statues';

export interface ServerlessDbOptions<T> {
  fileName: string;
  localRelativePath?: string;
  s3Key?: string;
  defaultData: T;
}

const fromD1: Record<string, () => Promise<unknown>> = {
  'posts-database.json': () => allPostRecords(),
  'tong-chi-data.json': () => allTongChi(),
  'gioi-thieu-database.json': () => allAbout(),
  'universe-database.json': () => allAreas(),
  'statues-database.json': () => liveStatueRecords(),
};

const bundled: Record<string, () => Promise<{ default: unknown }>> = {
  'danh-tang-database.json': () => import('@/data/danh-tang-database.json'),
  'reference-books-data.json': () => import('@/data/reference-books-data.json'),
  'memorial-data.json': () => import('@/data/memorial-data.json'),
};

/** Synchronous callers only ever get the default data. */
export function loadServerlessJson<T>(opts: ServerlessDbOptions<T>): T {
  return opts.defaultData;
}

export async function loadServerlessJsonAsync<T>(opts: ServerlessDbOptions<T>): Promise<T> {
  const d1 = fromD1[opts.fileName];
  if (d1) return (await d1()) as T;
  const file = bundled[opts.fileName];
  if (file) return (await file()).default as T;
  return opts.defaultData;
}
