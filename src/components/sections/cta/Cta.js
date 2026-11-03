import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import { site } from "@/config/site";

// Closing block at the end of inner pages, overlapping the top of the footer as in Bexon.
// T40 turns it into "Hỏi AI Hòa Phúc". Until the temple's photos arrive, the picture half
// shows the round seal on the footer's dark ground.
const Cta = () => {
	return (
		<section className="tj-cta-section tlhp-cta" aria-labelledby="tlhp-cta-title">
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="cta-area">
							<div className="cta-content">
								<h2 id="tlhp-cta-title" className="title title-anim">
									Về chùa tu học
								</h2>
								<p className="tlhp-cta-text">Khóa tu, cộng tu và đại lễ trong năm, kính mời quý vị cùng tham dự.</p>
								<div className="cta-btn wow fadeInUp" data-wow-delay=".6s">
									<ButtonPrimary text="Xem lịch tu học" url="/lich-tu-hoc" className="btn-dark" />
								</div>
							</div>
							<div className="cta-img tlhp-cta-art">
								<img src={site.sealLight.src} alt="" width={site.sealLight.width} height={site.sealLight.height} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Cta;
