// V3 on www's data: deleted posts are simply not published in www's D1, so nothing is listed here.
export interface DeletedPostRecord {
  id: string;
  wpPostId?: string | number;
  slug?: string;
  deletedAt?: string;
}

export function getDeletedPosts(): DeletedPostRecord[] {
  return [];
}
export async function getDeletedPostsAsync(): Promise<DeletedPostRecord[]> {
  return [];
}
export function isPostDeleted(): boolean {
  return false;
}
export async function isPostDeletedAsync(): Promise<boolean> {
  return false;
}
