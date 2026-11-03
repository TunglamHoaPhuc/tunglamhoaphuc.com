import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import Image from "next/image";

/**
 * Bexon's error block: the 404 page, and the page shown when something fails to load.
 * @param {{ title: string, text: string, action?: import("react").ReactNode, notFound?: boolean }} props
 */
const ErrorPrimary = ({ title, text, action, notFound = false }) => {
	return (
		<section className="tj-error-section">
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="tj-error-wrap text-center">
							<div className="tj-error-content">
								{/* The picture reads "404", so only the missing-page case shows it. */}
								{notFound ? (
									<div className="error-img">
										<Image
											src="/images/404/error.webp"
											alt=""
											width={800}
											height={303}
											style={{ height: "auto" }}
										/>
									</div>
								) : null}
								<h2 className="error-title title-anim">{title}</h2>
								<div className="error-desc">{text}</div>
								<div className="tlhp-error-actions">
									{action}
									<ButtonPrimary text="Về trang chủ" url="/" className="error-btn" />
									<ButtonPrimary text="Xem lịch tu học" url="/lich-tu-hoc" className="error-btn transparent-btn" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default ErrorPrimary;
