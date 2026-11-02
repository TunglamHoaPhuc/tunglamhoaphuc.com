import { describe, expect, it } from "vitest";
import { isPublicHost } from "@/libs/hosts";

describe("isPublicHost", () => {
	it.each(["www.tunglamhoaphuc.com", "tunglamhoaphuc.com", "WWW.TungLamHoaPhuc.com", "www.tunglamhoaphuc.com:443", "www.tunglamhoaphuc.com."])(
		"treats %s as the public site",
		(host) => expect(isPublicHost(host)).toBe(true),
	);

	it.each(["v2.tunglamhoaphuc.com", "quantri.tunglamhoaphuc.com", "localhost:4173", "www.tunglamhoaphuc.com.evil.example", "", null, undefined])(
		"treats %s as a non-public host",
		(host) => expect(isPublicHost(host)).toBe(false),
	);
});
