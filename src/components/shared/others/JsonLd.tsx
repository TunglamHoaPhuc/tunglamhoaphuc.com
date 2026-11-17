import { jsonLdText } from "@/libs/seo";

/** Structured data for search engines (T20). Server-rendered, so it is in the first HTML. */
export default function JsonLd({ data }: { data: unknown }) {
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
