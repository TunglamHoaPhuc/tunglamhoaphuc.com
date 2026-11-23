// A D1 read kept for a while, that survives a failed read and is never shared while it is pending. `renewing` (content/repository.ts)
// keeps whatever `make()` returned for `ttl` ms, and with a promise that includes a rejection (one transient D1 error then failed
// every page that used the value, for the whole time) and a read still in flight, which every other request then awaited. On
// Cloudflare a request that awaits a promise started by another request can be cancelled as "hung" (the Worker's code had hung and
// would never generate a response): it showed as a 503 on about one cache miss in 200 under parallel load. This one keeps only a
// value that has ARRIVED, with its expiry.

export type RenewOptions = {
	/** After a failed read that had an earlier good value to fall back on, how long before it is tried again. */
	retryMs?: number;
	now?: () => number;
	/** What the read is, for the log line of a failed one. */
	name?: string;
};

/**
 * The value `make()` read, served for `ttl` ms, then read again.
 *  - While a read is pending, a caller that needs the value starts a read of its own (a few duplicate reads when many requests
 *    arrive together at expiry): it never awaits a promise another request started. The newest read to start is the one kept.
 *  - A read that fails with an earlier good value in hand: that value is served (stale if error) and the next read is tried
 *    after `retryMs`.
 *  - A read that fails with nothing to fall back on: the error goes to that caller and nothing is kept, so the next call reads
 *    again.
 *  - A failed read is logged with `name`.
 */
export function renewingAsync<T>(make: () => Promise<T>, ttl: number, { retryMs = 5_000, now = Date.now, name = "renewingAsync" }: RenewOptions = {}): () => Promise<T> {
	let good: { value: T; seq: number } | undefined;
	let until = 0;
	let started = 0;
	return async () => {
		if (good && now() < until) return good.value;
		const seq = ++started;
		try {
			const value = await make();
			// A slower read that began earlier must not replace a newer value.
			if (!good || seq > good.seq) {
				good = { value, seq };
				until = now() + ttl;
			}
			return value;
		} catch (error) {
			console.error(`${name}: đọc lỗi`, error);
			if (!good) throw error;
			until = now() + retryMs;
			return good.value;
		}
	};
}
