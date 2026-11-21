import { isInlineSvg } from "./menuNav";

// The icon of a dropdown item: a picture, or inline SVG the server cleaned (library icon or an uploaded one).
// The default menu has pictures only, so it draws exactly what it always drew.
const MenuIcon = ({ item }) => {
	if (item.image) return <img src={item.image} alt="" width={128} height={128} loading="lazy" />;
	if (!isInlineSvg(item.svg)) return null;
	return (
		<span
			className="tlhp-menu-svg"
			style={{ display: "inline-flex", width: 24, height: 24, color: item.iconColor || "var(--tj-color-theme-primary)" }}
			dangerouslySetInnerHTML={{ __html: item.svg }}
		/>
	);
};

export default MenuIcon;
