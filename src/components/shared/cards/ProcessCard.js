import Link from "next/link";
import makeWowDelay from "@/libs/makeWowDelay";
import modifyNumber from "@/libs/modifyNumber";

/**
 * Bexon's process step: its number, title and text; the title leads to the step's page.
 * @param {{ step: { title: string, desc: string, href: string }, idx: number }} props
 */
const ProcessCard = ({ step, idx }) => {
	const { title, desc, href } = step;
	return (
		<li className="process-item wow fadeInLeft" data-wow-delay={makeWowDelay(idx, 0.3)}>
			<div className="process-step" aria-hidden="true">
				<span>{modifyNumber(idx + 1)}</span>
			</div>
			<div className="process-content">
				<h3 className="title h4">
					<Link href={href}>{title}</Link>
				</h3>
				{desc ? <p className="desc">{desc}</p> : null}
			</div>
		</li>
	);
};

export default ProcessCard;
