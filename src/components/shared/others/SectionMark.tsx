/**
 * The gold mark over a section title, as over every title of the old home page. The icons
 * are the temple's own set in public/brand/icons (128px, drawn for dark grounds).
 */
export default function SectionMark({ icon }: { icon: string }) {
	return (
		<span className="tlhp-sec-mark" aria-hidden="true">
			<img src={`/brand/icons/icon-${icon}.webp`} alt="" width={128} height={128} loading="lazy" decoding="async" />
		</span>
	);
}
