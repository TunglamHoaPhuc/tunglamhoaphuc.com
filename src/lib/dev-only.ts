/**
 * Internal tools (the photo review board at /kiem-tra-anh) exist only in development: on the public host they are a 404.
 * `env` is a parameter so a test can ask the question for production without touching process.env.
 */
export function isDevelopment(env: string | undefined = process.env.NODE_ENV): boolean {
	return env === "development";
}
