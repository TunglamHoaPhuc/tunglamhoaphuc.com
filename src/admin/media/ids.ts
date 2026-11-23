// The id of a library picture that came with the import: the first 20 hex digits of the SHA-1 of the address the
// picture was filed under (see storedMediaAddress and idOfAddress in src/db/import.ts). It is what lets an article that names
// a picture by its address (no `data-media-id`) be matched with its row in `media`.
import { storedMediaAddress } from "../../libs/content/media";

/** The media id the import gave the picture at `src`, or `null` when `src` is no address. Runs on a Worker (Web Crypto) and in Node. */
export async function mediaIdOfSrc(src: string): Promise<string | null> {
	// A picture uploaded through the library is served at /anh-goc/<bucket>/cms/<id>/v<n>/<name>: its id is in the address itself.
	const library = /\/anh-goc\/(?:[^/]+\/)?cms\/([A-Za-z0-9_-]+)\/v\d+\//.exec(src);
	if (library) return library[1];
	const address = storedMediaAddress(src);
	if (!address) return null;
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(address)));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

/** The addresses found in a piece of plain text (a summary, an intro): full URLs and /anh-goc/ paths. */
export function addressesIn(text: string): string[] {
	const found = text.match(/(?:https?:)?\/\/[^\s"'<>()[\]]+|\/anh-goc\/[^\s"'<>()[\]]+/g) ?? [];
	return found.map((address) => address.replace(/[.,;:!?]+$/, ""));
}
