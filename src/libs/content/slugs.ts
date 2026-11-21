// The old admin let two posts of a section share a slug (the second could not be reached). The admin's
// migration 0004 gives the later one (by date, then id) a -2, -3 … so every address leads somewhere, and the
// import and every content source do the same, so they all agree on the address of each post.
type Sluggable = { id: string; section: string; slug: string; publishedDate: string };

const binary = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The new slug of each post that has to change, by id. Posts whose slug is already the only one of its section are not listed. */
export function slugRenames(posts: readonly Sluggable[]): Map<string, string> {
	const groups = new Map<string, Sluggable[]>();
	for (const post of posts) {
		const key = `${post.section}\u0000${post.slug}`;
		groups.set(key, [...(groups.get(key) ?? []), post]);
	}
	const renames = new Map<string, string>();
	for (const group of groups.values()) {
		if (group.length < 2) continue;
		[...group].sort((a, b) => binary(a.publishedDate, b.publishedDate) || binary(a.id, b.id)).forEach((post, index) => {
			if (index > 0) renames.set(post.id, `${post.slug}-${index + 1}`);
		});
	}
	return renames;
}

/** The same posts, the later of two that share a slug carrying -2, -3 …; the list itself when no slug is shared. */
export function uniqueSlugs<T extends Sluggable>(posts: readonly T[]): T[] {
	const renames = slugRenames(posts);
	return renames.size ? posts.map((post) => (renames.has(post.id) ? { ...post, slug: renames.get(post.id) as string } : post)) : [...posts];
}
