// A D1 read kept for a while, that survives a failed read. `renewing` (tlhp-content/repository.ts) keeps whatever `make()` returned
// for `ttl` ms, and with a promise that includes a rejection: one transient D1 error ("overloaded", "network connection lost") then
// failed every page that used the value, for the whole time, in that Worker instance. This one never keeps a failure.

export type RenewOptions = {
	/** After a failed read that had an earlier good value to fall back on, how long before it is tried again. */
	retryMs?: number;
	now?: () => number;
};

/**
 * The value `make()` read, served for `ttl` ms, then read again. Callers that arrive during a read share it.
 *  - A read that fails with an earlier good value in hand: that value is served (stale if error) and the next read is tried
 *    after `retryMs`.
 *  - A read that fails with nothing to fall back on: the error goes to the callers waiting for it and nothing is kept, so the next
 *    call reads again.
 */
export function renewingAsync<T>(make: () => Promise<T>, ttl: number, { retryMs = 5_000, now = Date.now }: RenewOptions = {}): () => Promise<T> {
	let good: { value: T } | undefined;
	let until = 0;
	let inflight: Promise<T> | undefined;
	return () => {
		if (good && now() < until) return Promise.resolve(good.value);
		if (!inflight) {
			const read = Promise.resolve()
				.then(make)
				.then(
					(value) => {
						good = { value };
						until = now() + ttl;
						return value;
					},
					(error: unknown) => {
						if (!good) throw error;
						until = now() + retryMs;
						return good.value;
					},
				);
			inflight = read;
			const done = () => {
				if (inflight === read) inflight = undefined;
			};
			read.then(done, done);
		}
		return inflight;
	};
}
