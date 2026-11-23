import { jsonLdText } from "@/lib/v3-jsonld";

/** Dữ liệu có cấu trúc cho máy tìm kiếm. Dựng ở máy chủ nên nằm ngay trong HTML đầu tiên. Không có dữ liệu thì không vẽ gì. */
export default function JsonLd({ data }: { data: object | object[] | null | undefined }) {
	const list = Array.isArray(data) ? data : data ? [data] : [];
	return (
		<>
			{list.map((item, index) => (
				<script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(item) }} />
			))}
		</>
	);
}
