import Link from "next/link";

/**
 * @param {{ text: string, url?: string, className?: string, isTextBtn?: boolean, type?: "button" | "submit" | "reset", iconName?: string, newTab?: boolean }} props
 */
const ButtonPrimary = ({ className, text, isTextBtn, url, type, iconName, newTab }) => {
	const linkClassName = `${isTextBtn ? "text-btn" : "tj-primary-btn"} ${className ? className : ""}`;
	const content = (
		<>
			<span className="btn-text">
				<span>{text}</span>
			</span>
			<span className="btn-icon" aria-hidden="true">
				<i className="tji-arrow-right-long"></i>
			</span>
		</>
	);
	return (
		<>
			{type ? (
				<button
					type={type ? type : "submit"}
					className={`tj-primary-btn ${className ? className : ""}`}
				>
					{content}
				</button>
			) : newTab ? (
				// Another site (Google Maps…): a plain link that opens a new tab, and says so.
				<a href={url} className={linkClassName} target="_blank" rel="noopener noreferrer">
					{content}
					<span className="visually-hidden"> (mở trong thẻ mới)</span>
				</a>
			) : (
				<Link href={url ? url : "/"} className={linkClassName}>
					{content}
				</Link>
			)}
		</>
	);
};

export default ButtonPrimary;
