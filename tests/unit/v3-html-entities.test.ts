import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeHtmlEntities } from "@/lib/html-entities";

test("decodes the entities the admin and WordPress write, in one pass", () => {
	assert.equal(decodeHtmlEntities("Một &lt; hai và ba &gt; bốn"), "Một < hai và ba > bốn");
	assert.equal(decodeHtmlEntities("Tâm &amp; Trí"), "Tâm & Trí");
	// the text "&lt;" typed by an editor is stored as "&amp;lt;" and must show as typed, not as "<"
	assert.equal(decodeHtmlEntities("&amp;lt;b&amp;gt;"), "&lt;b&gt;");
	assert.equal(decodeHtmlEntities("&#8220;Xin chào&#8221; &ndash; &#038; &quot;a&quot; &#x2019;"), "“Xin chào” – & \"a\" ’");
	assert.equal(decodeHtmlEntities("a&nbsp;b &unknown; c"), "a b &unknown; c");
	assert.equal(decodeHtmlEntities(null), "");
	assert.equal(decodeHtmlEntities(""), "");
});
