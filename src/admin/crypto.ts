// Encrypts the few secrets the database must hold in a form it can give back (2FA secrets, the
// SMTP password): AES-256-GCM with the key ADMIN_ENC_KEY, one random nonce per value.
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function key(base64Key: string, usage: KeyUsage): Promise<CryptoKey> {
	const raw = unb64(base64Key);
	if (raw.length !== 32) throw new Error("ADMIN_ENC_KEY must be 32 bytes, base64");
	return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
}

export async function encryptSecret(plain: string, base64Key: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(base64Key, "encrypt"), new TextEncoder().encode(plain)));
	return `v1.${b64(iv)}.${b64(sealed)}`;
}

export async function decryptSecret(sealed: string, base64Key: string): Promise<string> {
	const [version, iv, data] = sealed.split(".");
	if (version !== "v1" || !iv || !data) throw new Error("unknown secret format");
	const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(base64Key, "decrypt"), unb64(data));
	return new TextDecoder().decode(plain);
}
