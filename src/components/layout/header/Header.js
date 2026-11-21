import HeaderClient from "./HeaderClient";
import { loadHeaderNav } from "./headerNav";

// A server component: it reads the menu the admin edited (null until the admin has edited it, or when the site does
// not read from D1, or when the read fails; the header then draws `site.nav` exactly as before) and hands it to the
// client header. Props pass through, so callers use it as they always did.
const Header = async (props) => {
	const nav = await loadHeaderNav().catch(() => null);
	return <HeaderClient {...props} nav={nav} />;
};

export default Header;
