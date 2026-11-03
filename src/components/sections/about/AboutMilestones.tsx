import type { Milestone } from "@/libs/content/types";

// Bexon's history timeline (History1) as an ordered list, so screen readers say "1 of 4"
// and read each step in order: its label (a year or a phase), title and text. The big
// numbers are drawn for the eye only.
export default function AboutMilestones({ milestones }: { milestones: Milestone[] }) {
	return (
		<ol className="timeline tlhp-milestones">
			{milestones.map((milestone, idx) => (
				<li key={idx} className="timeline-inner wow fadeInUp" data-wow-delay={`0.${Math.min(idx + 1, 9)}s`}>
					<p className="date">{milestone.label}</p>
					<div className="content">
						<div className="top">
							<span aria-hidden="true">{String(idx + 1).padStart(2, "0")}.</span>
							<h3 className="title h4">{milestone.title}</h3>
							{milestone.description ? <p>{milestone.description}</p> : null}
						</div>
					</div>
				</li>
			))}
		</ol>
	);
}
