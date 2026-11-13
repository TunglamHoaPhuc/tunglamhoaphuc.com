import sliceText from "@/libs/sliceText";
import Link from "next/link";
import React from "react";
/**
 * Bexon's inner page banner: title, then the breadcrumb (Trang chủ › … › text).
 * @param {{ title: string, text: string, breadcrums?: { name: string, path?: string }[], className?: string }} props
 */
const HeroInner = ({ title, text, breadcrums = [], className = "" }) => {
	return (
		<section className={`tj-page-header section-gap-x ${className}`}>
			<div className="container">
				<div className="row">
					<div className="col-lg-12">
						<div className="tj-page-header-content text-center">
							<h1 className={`tj-page-title`}>{title}</h1>
							<nav className="tj-page-link" aria-label="Đường dẫn">
								<span>
									<i className="tji-home" aria-hidden="true"></i>
								</span>
								<span>
									<Link href="/">Trang chủ</Link>
								</span>
								<span>
									<i className="tji-arrow-right" aria-hidden="true"></i>
								</span>
								{breadcrums?.length
									? breadcrums?.map(({ name, path }, idx) => (
											<React.Fragment key={idx}>
												<span>
													<Link href={path ? path : "/"}>{name}</Link>
												</span>
												<span>
													<i className="tji-arrow-right" aria-hidden="true"></i>
												</span>
											</React.Fragment>
									  ))
									: ""}
								<span>
									<span aria-current="page">{sliceText(text, 28, true)}</span>
								</span>
							</nav>
						</div>
					</div>
				</div>
			</div>
			<div className="page-header-overlay"></div>
		</section>
	);
};

export default HeroInner;
