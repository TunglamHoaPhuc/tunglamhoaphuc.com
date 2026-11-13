import { scriptRuns } from "@/libs/triTue";

// A text with Tibetan words in it: those are marked lang="bo", so screen readers switch voice
// and the browser picks a Tibetan font.
export default function Tibetan({ text }: { text: string }) {
	return (
		<>
			{scriptRuns(text).map((run, index) =>
				run.tibetan ? (
					<span key={index} lang="bo" className="tlhp-tibetan">
						{run.text}
					</span>
				) : (
					run.text
				),
			)}
		</>
	);
}
