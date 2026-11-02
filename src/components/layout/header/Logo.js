import { site } from "@/config/site";
import Link from "next/link";

// The Mộc Ấn seal carries the name in tiny letters, so the name is also set beside it
// in type; the seal is decorative and the link is named by that text.
const Logo = () => {
	return (
		<div className="site_logo tlhp-logo">
			<Link className="logo" href="/">
				<img src={site.logo.src} alt="" width={site.logo.width} height={site.logo.height} className="tlhp-logo-seal" />
				<span className="tlhp-logo-name">{site.name}</span>
			</Link>
		</div>
	);
};

export default Logo;
