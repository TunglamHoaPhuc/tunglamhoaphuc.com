/**
 * The temple's icons (public/brand/icons, 128px, gold, drawn for dark grounds) and what each
 * was drawn for (bo-nhan-dien/README_BO_NHAN_DIEN.md). An icon goes only over what it names;
 * a block the set has nothing for takes the round logo ("logo"), never a neighbour's icon.
 */
export type BrandIcon =
	| "logo"
	| "tong-chi-tu-hoc"
	| "dong-chay-hoang-phap"
	| "dau-an-hoang-phap"
	| "tin-moi-nhat"
	| "lich-tu-hoc"
	| "cac-khu-vuc-noi-bat"
	| "cac-bao-tuong-noi-bat"
	| "tri-tue-phat-phap"
	| "phap-am"
	| "quote-chu-de"
	| "cong-tu"
	| "khoa-le-truyen-thong"
	| "dai-le-su-kien"
	| "tinh-do-nhan-gian";

export const brandIconSrc = (icon: BrandIcon) => (icon === "logo" ? "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" : `/brand/icons/icon-${icon}.webp`);

/** The gold mark over a section title, as over every title of the old home page. */
export default function SectionMark({ icon }: { icon: BrandIcon }) {
	return (
		<span className="tlhp-sec-mark" aria-hidden="true">
			<img src={brandIconSrc(icon)} alt="" width={128} height={128} loading="lazy" decoding="async" />
		</span>
	);
}
