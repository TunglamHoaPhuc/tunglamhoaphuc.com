import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import SiteShell from "@/components/layout/SiteShell";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import BlogCard2 from "@/components/shared/cards/BlogCard2";
import ServiceCard2 from "@/components/shared/cards/ServiceCard2";
import TeamCard from "@/components/shared/cards/TeamCard";
import type { PostSummary } from "@/libs/content/types";
import { isPublicHost } from "@/libs/hosts";

export const metadata: Metadata = {
	title: "Bảng mẫu giao diện – Tùng Lâm Hòa Phúc",
	robots: { index: false, follow: false },
};

// Bexon variables after the TLHP bridge, so a wrong mapping shows up as a wrong swatch.
const SWATCHES: [string, string][] = [
	["Nền trang", "--tj-color-grey-1"],
	["Nền xen kẽ", "--tj-color-theme-bg"],
	["Màu chính", "--tj-color-theme-primary"],
	["Tiêu đề", "--tj-color-heading-primary"],
	["Thân bài", "--tj-color-text-body"],
	["Chữ phụ", "--tj-color-text-body-3"],
	["Section tối", "--tj-color-theme-dark"],
	["Viền", "--tj-color-border-1"],
	["Hoại sắc", "--tlhp-accent"],
	["Chu sa", "--tj-color-red-1"],
];

// Every level carries stacked marks (Ẫ Ộ Ữ Ỹ) and dot-below marks (ạ ợ) to catch clipped or colliding lines.
const HEADINGS = [
	["h1", "Nơi để trở về – Ẫ Ộ Ữ Ỹ ạ ợ"],
	["h2", "Khóa tu mùa hè – Ẫ Ộ Ữ Ỹ ạ ợ"],
	["h3", "Thời khóa công phu – Ẫ Ộ Ữ Ỹ ạ ợ"],
	["h4", "Tụng kinh ngày rằm – Ẫ Ộ Ữ Ỹ ạ ợ"],
	["h5", "Lịch sinh hoạt – Ẫ Ộ Ữ Ỹ ạ ợ"],
	["h6", "Ghi chú nhỏ – Ẫ Ộ Ữ Ỹ ạ ợ"],
] as const;

// Sample notice so the strip can be reviewed before the temple publishes a real one.
const SAMPLE_ANNOUNCEMENT = {
	id: "styleguide-mau",
	text: "Mẫu dải thông báo: khóa tu mùa đông mở đăng ký từ ngày 01/12.",
	link: { label: "Xem lịch tu học", href: "/lich-tu-hoc" },
};

// Sample content in the shape the Bexon cards read; real data arrives with T4.
const SAMPLE_POST: PostSummary = {
	id: "mau",
	slug: "y-nghia-ngay-ram-thang-bay",
	title: "Ý nghĩa ngày rằm tháng Bảy – Vu Lan báo hiếu",
	subtitle: "",
	section: "dong-chay-hoang-phap",
	category: { slug: "dai-le-su-kien", name: "Đại Lễ Sự Kiện" },
	author: "",
	publishedDate: "2026-08-15",
	views: 1280,
	thumbnail: { src: "/images/blog/blog-4.webp", position: "center 50%" },
	banner: null,
	summary: "Mùa Vu Lan nhắc người con Phật nhớ ơn cha mẹ, ông bà và tổ tiên.",
	galleryCount: 0,
};
const SAMPLE_MEMBER = { id: 1, name: "Thầy Thích Ấn Định", desig: "Trụ trì", img: "/images/team/team-1.webp" };
const SAMPLE_GROUP = {
	slug: "phuong-phap-hanh-tri",
	name: "Phương Pháp Hành Trì",
	line: "Lấy các pháp môn hành trì làm phương tiện chuyển hóa.",
	icon: "tji-service-3",
	articles: [
		{ id: "1", slug: "niem-phat-phuong-phap-tro-hanh", title: "Niệm Phật", name: "Niệm Phật", subtitle: "Lục tự cứu cánh", group: { slug: "phuong-phap-hanh-tri", name: "Phương Pháp Hành Trì" }, banner: null, excerpt: "" },
		{ id: "2", slug: "thien-tap-tinh-lang-tu-than", title: "Thiền Tập", name: "Thiền Tập", subtitle: "Thanh tịnh giải thoát", group: { slug: "phuong-phap-hanh-tri", name: "Phương Pháp Hành Trì" }, banner: null, excerpt: "" },
	],
};

const swatchStyle = (variable: string): CSSProperties => ({
	background: `var(${variable})`,
	height: 72,
	borderRadius: 10,
	border: "1px solid var(--tj-color-border-1)",
});

function Block({ title, children, dark = false }: { title: string; children: ReactNode; dark?: boolean }) {
	return (
		<section
			className={`section-gap${dark ? " tlhp-dark" : ""}`}
			style={dark ? { background: "var(--tlhp-bg)", color: "var(--tlhp-fg)", borderRadius: 16, margin: "0 8px" } : undefined}
			aria-label={title}
		>
			<div className="container">{children}</div>
		</section>
	);
}

export default async function StyleguidePage() {
	if (isPublicHost((await headers()).get("host"))) notFound();

	return (
		// The search popup is previewed here only, until /tim-kiem exists (T18).
		<SiteShell showSearch announcement={SAMPLE_ANNOUNCEMENT}>
			<main>
				{/* Clear the floating header, as Bexon's inner page banners do. */}
				<div style={{ height: 120 }} aria-hidden="true" />
				<Block title="Giới thiệu">
					<h1>Bảng mẫu giao diện</h1>
					<p>
						Trang nội bộ để soát màu, chữ, nút và hiệu ứng của theme Bexon sau khi đổi sang bộ nhận diện Tùng Lâm
						Hòa Phúc. Không mở trên tên miền chính.
					</p>
				</Block>

				<Block title="Màu">
					<h2>Màu</h2>
					<div className="row g-4 mt-2">
						{SWATCHES.map(([label, variable]) => (
							<div key={variable} className="col-6 col-md-4 col-lg-2">
								<div data-swatch={variable} style={swatchStyle(variable)} />
								<p className="mb-0 mt-2">{label}</p>
								<code>{variable}</code>
							</div>
						))}
					</div>
				</Block>

				<Block title="Chữ">
					{HEADINGS.map(([Tag, text]) => (
						<Tag key={Tag}>{text}</Tag>
					))}
					<p>
						Thân bài dùng Be Vietnam Pro 17–18px, dòng cao 1.7. Người cao tuổi đọc trên điện thoại vẫn thấy rõ từng
						dấu: hỏi, ngã, sắc, huyền, nặng – “Ấn tượng, Ộ, Ữ, Ỹ, ạ, ặ, ợ”.
					</p>
				</Block>

				<Block title="Tiêu đề section và hiệu ứng tách chữ">
					<div className="sec-heading style-2">
						<span className="sub-title">Lịch tu học</span>
						<h2 className="sec-title title-anim">
							Ấn định khóa tu Ộ Ữ Ỹ <span>ạ ặ ợ.</span>
						</h2>
					</div>
					<div className="sec-heading style-2">
						<span className="sub-title">Tin tức – Pháp thoại</span>
						<h2 className="sec-title text-anim">
							Những lời dạy ẩn dụ của Thầy <span>Ẫn Ỵ.</span>
						</h2>
					</div>
					<h2 className="hero-text-anim">Chốn thiêng bình yên giữa đất trời Ấn Ỡ</h2>
				</Block>

				<Block title="Nút">
					<h2>Nút</h2>
					<div className="d-flex flex-wrap gap-3 align-items-center mt-4">
						<ButtonPrimary text="Đăng ký khóa tu" url="/dang-ky" />
						<ButtonPrimary text="Gửi đăng ký" type="button" />
						<ButtonPrimary text="Xem lịch tu học" url="/lich-tu-hoc" className="transparent-btn" />
						<ButtonPrimary text="Đọc thêm" url="/tin-tuc" isTextBtn />
						<ButtonPrimary text="Ủng hộ Tam Bảo" url="/lien-he" className="tj-primary-btn-lg" />
					</div>
				</Block>

				<Block title="Thẻ">
					<h2>Thẻ</h2>
					<div className="row g-4 mt-2">
						<div className="col-md-6 col-lg-4">
							<BlogCard2 post={SAMPLE_POST} />
						</div>
						<div className="col-md-6 col-lg-4">
							<TeamCard teamMember={SAMPLE_MEMBER} />
						</div>
					</div>
				</Block>

				<Block title="Biểu mẫu">
					<h2>Biểu mẫu</h2>
					<form className="contact-form mt-4" action="#" aria-label="Biểu mẫu mẫu">
						<div className="row">
							<div className="col-sm-6">
								<div className="form-input">
									<label htmlFor="sg-name">Họ và tên</label>
									<input id="sg-name" type="text" name="name" autoComplete="name" placeholder="Nguyễn Văn An" />
								</div>
							</div>
							<div className="col-sm-6">
								<div className="form-input">
									<label htmlFor="sg-phone">Số điện thoại</label>
									<input id="sg-phone" type="tel" name="phone" autoComplete="tel" placeholder="0912 345 678" />
								</div>
							</div>
							<div className="col-sm-12">
								<div className="form-input message-input">
									<label htmlFor="sg-message">Lời nhắn</label>
									<textarea id="sg-message" name="message" placeholder="Con muốn hỏi về khóa tu…" />
								</div>
							</div>
							<div className="submit-btn">
								<ButtonPrimary text="Gửi lời nhắn" type="button" />
							</div>
						</div>
					</form>
				</Block>

				<Block title="Section tối" dark>
					<div className="sec-heading style-2">
						<span className="sub-title">Đêm thiền</span>
						<h2 className="sec-title">
							Section tối dùng lớp <span>tlhp-dark.</span>
						</h2>
					</div>
					<p>Mọi biến màu bên trong tự đổi sang bảng màu tối, kể cả chữ, viền và nút.</p>
					<div className="d-flex flex-wrap gap-3 align-items-center mt-4">
						<ButtonPrimary text="Đăng ký khóa tu" url="/dang-ky" />
						<ButtonPrimary text="Xem lịch tu học" url="/lich-tu-hoc" className="transparent-btn" />
					</div>
					<div className="tj-service-section service-2 mt-5 p-0">
						<div className="service-wrapper-2">
							<ServiceCard2 group={SAMPLE_GROUP} />
						</div>
					</div>
				</Block>
			</main>
		</SiteShell>
	);
}
