// Where the library's files are kept: the private R2 bucket tlhp-media. A picture's `media.r2_key` is the
// key as the site's /anh-goc/s2-cnv03/<key> address reads it, and that address reads R2 under
// "s2-cnv03/<key>": this store adds the prefix, so the rest of the admin only ever speaks in r2_keys.
export type MediaStore = {
	put(key: string, body: Uint8Array, contentType: string): Promise<void>;
	delete(keys: string[]): Promise<void>;
};

/** The part of an R2 bucket binding the store uses. */
export type R2Like = {
	put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
	delete(keys: string | string[]): Promise<void>;
};

const PREFIX = "s2-cnv03/";

export function r2Store(bucket: R2Like): MediaStore {
	return {
		put: async (key, body, contentType) => void (await bucket.put(`${PREFIX}${key}`, body, { httpMetadata: { contentType } })),
		delete: async (keys) => {
			if (keys.length) await bucket.delete(keys.map((key) => `${PREFIX}${key}`));
		},
	};
}
