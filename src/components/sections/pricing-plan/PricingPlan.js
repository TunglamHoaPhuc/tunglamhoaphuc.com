import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import PricingPlanItems from "@/components/shared/pricing-plan/PricingPlanItems";

/**
 * Bexon's pricing plans as Khóa tu sắp tới (plan.md, home block 3): the next events of the
 * schedule in place of the three plans. Nothing at all when the schedule has nothing left.
 * @param {{ events?: import("@/libs/home").UpcomingEvent[] }} props
 */
const PricingPlan = ({ events = [] }) => {
	if (!events.length) return null;
	return (
		<section className="tj-pricing-section section-gap tlhp-upcoming" aria-labelledby="khoa-tu-sap-toi">
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading text-center style-2">
							<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
								Lịch tu học
							</span>
							<h2 id="khoa-tu-sap-toi" className="sec-title text-anim">
								Khóa tu <span>sắp tới.</span>
							</h2>
						</div>
					</div>
				</div>
				<div className="row row-gap-4 justify-content-center">
					<PricingPlanItems events={events} />
				</div>
				<div className="tlhp-upcoming-more">
					<ButtonPrimary text="Xem lịch tu học" url="/lich-tu-hoc" />
				</div>
			</div>
			<div className="bg-shape-1">
				<img src="/images/shape/pattern-2.svg" alt="" loading="lazy" decoding="async" />
			</div>
			<div className="bg-shape-2">
				<img src="/images/shape/pattern-3.svg" alt="" loading="lazy" decoding="async" />
			</div>
		</section>
	);
};

export default PricingPlan;
