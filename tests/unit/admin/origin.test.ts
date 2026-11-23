// Q10 and Q9: which host and Origin count as the admin's own address (src/admin/http/origin.ts).
import { describe, expect, it } from "vitest";
import { isAdminHost, isAdminOrigin } from "../../../src/admin/http/origin";

const BASE = "https://www.tunglamhoaphuc.com";

describe("isAdminHost (the preview page calls notFound() when this is false)", () => {
	it("accepts only the host of ADMIN_BASE_URL, any letter case", () => {
		expect(isAdminHost("www.tunglamhoaphuc.com", BASE)).toBe(true);
		expect(isAdminHost("WWW.TungLamHoaPhuc.com", BASE)).toBe(true);
		expect(isAdminHost("tunglamhoaphuc.com", BASE)).toBe(false);
		expect(isAdminHost("v2.tunglamhoaphuc.com", BASE)).toBe(false);
		expect(isAdminHost("v3.tunglamhoaphuc.com", BASE)).toBe(false);
		expect(isAdminHost("www.tunglamhoaphuc.com.evil.example", BASE)).toBe(false);
		expect(isAdminHost("www.tunglamhoaphuc.com:8443", BASE)).toBe(false);
	});

	it("keeps the port of a development address", () => {
		expect(isAdminHost("localhost:3001", "http://localhost:3001")).toBe(true);
		expect(isAdminHost("localhost:3002", "http://localhost:3001")).toBe(false);
		expect(isAdminHost("localhost", "http://localhost:3001")).toBe(false);
	});

	it("says no when there is no host, no base or a broken base (never throws)", () => {
		expect(isAdminHost(null, BASE)).toBe(false);
		expect(isAdminHost(undefined, BASE)).toBe(false);
		expect(isAdminHost("", BASE)).toBe(false);
		expect(isAdminHost("www.tunglamhoaphuc.com", undefined)).toBe(false);
		expect(isAdminHost("www.tunglamhoaphuc.com", "không phải địa chỉ")).toBe(false);
		expect(isAdminHost("www.tunglamhoaphuc.com", "javascript:alert(1)")).toBe(false);
	});
});

describe("isAdminOrigin", () => {
	it("compares scheme, host and port", () => {
		expect(isAdminOrigin(BASE, BASE)).toBe(true);
		expect(isAdminOrigin("https://WWW.tunglamhoaphuc.com", BASE)).toBe(true);
		expect(isAdminOrigin("http://www.tunglamhoaphuc.com", BASE)).toBe(false);
		expect(isAdminOrigin("https://www.tunglamhoaphuc.com:8443", BASE)).toBe(false);
		expect(isAdminOrigin("https://tunglamhoaphuc.com", BASE)).toBe(false);
	});

	it("refuses null, junk and non-http origins instead of throwing", () => {
		for (const origin of ["null", "not a url", "file:///etc/passwd", "data:text/html,x", "", null, undefined]) expect(isAdminOrigin(origin, BASE), String(origin)).toBe(false);
		expect(isAdminOrigin(BASE, "oops")).toBe(false);
		expect(isAdminOrigin(BASE, undefined)).toBe(false);
	});
});
