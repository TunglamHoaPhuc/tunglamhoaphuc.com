type Props = {
	paused: boolean;
	onClick: () => void;
	/** What moves, read after the visible words: "Tạm dừng" + " ảnh đầu trang". */
	what: string;
	className?: string;
};

// The stop button every self-moving slider and sliding row carries (WCAG 2.2.2). It says in
// words what pressing it will do; with reduced motion nothing moves and CSS hides it. The
// two signs are drawn here rather than taken from an icon font no other part of the page loads.
export default function PauseButton({ paused, onClick, what, className = "" }: Props) {
	return (
		<button type="button" className={`tlhp-pause ${className}`} onClick={onClick}>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
				<path d={paused ? "M2.5 1.2v9.6L10.6 6z" : "M2 1.5h2.8v9H2zM7.2 1.5H10v9H7.2z"} fill="currentColor" />
			</svg>
			<span>{paused ? "Chạy tiếp" : "Tạm dừng"}</span>
			<span className="visually-hidden"> {what}</span>
		</button>
	);
}
