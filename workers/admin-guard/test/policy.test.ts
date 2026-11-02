import { describe, expect, it } from "vitest";
import { decide, normalizePath } from "../src/policy";

describe("decide", () => {
  it.each([
    ["GET", "/api/admin/schedule"],
    ["GET", "/api/admin/posts"],
    ["GET", "/api/admin/posts/thang-bay-thang-cua-hieu-an-va-tinh-thuong"],
    ["GET", "/api/admin/tong-chi"],
    ["GET", "/api/admin/tong-chi/tiep-buoc-thay-toi"],
    ["GET", "/api/admin/gioi-thieu/lich-su-tung-lam-hoa-phuc"],
    ["HEAD", "/api/admin/schedule"],
    ["POST", "/api/public/increment-view"],
    ["GET", "/dong-chay-hoang-phap"],
    ["POST", "/api/home/news-carousel"],
  ])("lets %s %s through (public site needs it)", (method, path) => {
    expect(decide(method, path)).toBe("pass");
  });

  it.each([
    ["POST", "/api/admin/posts"],
    ["PUT", "/api/admin/tong-chi/abc"],
    ["PATCH", "/api/admin/posts/post-1060"],
    ["DELETE", "/api/admin/posts"],
    ["post", "/api/admin/schedule"],
    ["GET", "/api/admin/sync-wp"],
    ["GET", "/api/admin/sync-wp-posts"],
    ["GET", "/api/admin/gioi-thieu/sync-wp"],
    ["GET", "/api/admin/vu-tru/sync-wp"],
    ["GET", "/api/admin/wp-post-create"],
    ["GET", "/api/admin/wp-media"],
    ["GET", "/api/admin/repair-links"],
    ["GET", "/api/admin/upload"],
    ["GET", "/api/admin/fetch-metadata"],
  ])("requires login for %s %s", (method, path) => {
    expect(decide(method, path)).toBe("require-login");
  });

  it.each([
    "//api//admin/sync-wp",
    "/API/ADMIN/SYNC-WP",
    "/api/admin%2Fsync-wp",
    "/api%2Fadmin%2Fupload",
  ])("does not let path tricks hide %s", (path) => {
    expect(decide("GET", path)).toBe("require-login");
  });

  it("requires login when the path cannot be decoded", () => {
    expect(decide("GET", "/api/admin/%E0%A4%A")).toBe("require-login");
  });
});

describe("normalizePath", () => {
  it("decodes, collapses slashes and lowercases", () => {
    expect(normalizePath("//API//Admin%2Fposts")).toBe("/api/admin/posts");
  });
});
