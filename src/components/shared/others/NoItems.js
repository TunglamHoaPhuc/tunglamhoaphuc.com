import ButtonPrimary from "../buttons/ButtonPrimary";

/**
 * An empty list, with the way back. Bexon's version borrowed WooCommerce's cart markup.
 * @param {{ title: string, text?: string, navUrl?: string, navText?: string }} props
 */
const NoItems = ({ title, text, navUrl = "/", navText = "Về trang chủ" }) => {
	return (
		<div className="tlhp-empty">
			<p className="tlhp-empty-title">{title}</p>
			{text ? <p className="tlhp-empty-text">{text}</p> : null}
			<ButtonPrimary text={navText} url={navUrl} />
		</div>
	);
};

export default NoItems;
