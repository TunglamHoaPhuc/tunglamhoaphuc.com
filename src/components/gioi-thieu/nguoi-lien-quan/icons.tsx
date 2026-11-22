// Biểu tượng lucide-react v1.23.0 (ISC) mà trang Tiểu sử Sư Tổ của web cũ dùng, chép nguyên hình
// để trang giống hệt; web mới không có lucide-react. Sinh một lần từ
// node_modules/lucide-react/dist/esm/icons của web cũ.
import type { SVGProps } from "react";

type IconNode = [string, Record<string, string>][];
export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function makeIcon(name: string, node: IconNode) {
	function Icon({ className, size = 24, ...rest }: IconProps) {
		return (
			<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`lucide lucide-${name}${className ? ` ${className}` : ""}`} {...rest}>
				{node.map(([tag, attrs], i) => {
					const Tag = tag as "path";
					return <Tag key={i} {...attrs} />;
				})}
			</svg>
		);
	}
	Icon.displayName = name;
	return Icon;
}

export const ArrowLeft = makeIcon("arrow-left", [["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]]);
export const ArrowRight = makeIcon("arrow-right", [["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]]);
export const ArrowUpRight = makeIcon("arrow-up-right", [["path",{"d":"M7 7h10v10"}],["path",{"d":"M7 17 17 7"}]]);
export const BookOpen = makeIcon("book-open", [["path",{"d":"M12 7v14"}],["path",{"d":"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"}]]);
export const Check = makeIcon("check", [["path",{"d":"M20 6 9 17l-5-5"}]]);
export const CheckCircle2 = makeIcon("check-circle-2", [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m9 12 2 2 4-4"}]]);
export const ChevronDown = makeIcon("chevron-down", [["path",{"d":"m6 9 6 6 6-6"}]]);
export const ChevronLeft = makeIcon("chevron-left", [["path",{"d":"m15 18-6-6 6-6"}]]);
export const ChevronRight = makeIcon("chevron-right", [["path",{"d":"m9 18 6-6-6-6"}]]);
export const Compass = makeIcon("compass", [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"}]]);
export const Copy = makeIcon("copy", [["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]]);
export const Download = makeIcon("download", [["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]]);
export const ExternalLink = makeIcon("external-link", [["path",{"d":"M15 3h6v6"}],["path",{"d":"M10 14 21 3"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]]);
export const Flame = makeIcon("flame", [["path",{"d":"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"}]]);
export const Heart = makeIcon("heart", [["path",{"d":"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"}]]);
export const ImageIcon = makeIcon("image", [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]]);
export const Layers = makeIcon("layers", [["path",{"d":"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"}],["path",{"d":"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"}],["path",{"d":"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"}]]);
export const LayoutGrid = makeIcon("layout-grid", [["rect",{"width":"7","height":"7","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"14","rx":"1"}],["rect",{"width":"7","height":"7","x":"3","y":"14","rx":"1"}]]);
export const Leaf = makeIcon("leaf", [["path",{"d":"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"}],["path",{"d":"M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"}]]);
export const Maximize = makeIcon("maximize", [["path",{"d":"M8 3H5a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 8V5a2 2 0 0 0-2-2h-3"}],["path",{"d":"M3 16v3a2 2 0 0 0 2 2h3"}],["path",{"d":"M16 21h3a2 2 0 0 0 2-2v-3"}]]);
export const Maximize2 = makeIcon("maximize-2", [["path",{"d":"M15 3h6v6"}],["path",{"d":"m21 3-7 7"}],["path",{"d":"m3 21 7-7"}],["path",{"d":"M9 21H3v-6"}]]);
export const Mic = makeIcon("mic", [["path",{"d":"M12 19v3"}],["path",{"d":"M19 10v2a7 7 0 0 1-14 0v-2"}],["rect",{"x":"9","y":"2","width":"6","height":"13","rx":"3"}]]);
export const Minimize = makeIcon("minimize", [["path",{"d":"M8 3v3a2 2 0 0 1-2 2H3"}],["path",{"d":"M21 8h-3a2 2 0 0 1-2-2V3"}],["path",{"d":"M3 16h3a2 2 0 0 1 2 2v3"}],["path",{"d":"M16 21v-3a2 2 0 0 1 2-2h3"}]]);
export const MonitorPlay = makeIcon("monitor-play", [["path",{"d":"M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z"}],["path",{"d":"M12 17v4"}],["path",{"d":"M8 21h8"}],["rect",{"x":"2","y":"3","width":"20","height":"14","rx":"2"}]]);
export const Pause = makeIcon("pause", [["rect",{"x":"14","y":"3","width":"5","height":"18","rx":"1"}],["rect",{"x":"5","y":"3","width":"5","height":"18","rx":"1"}]]);
export const Play = makeIcon("play", [["path",{"d":"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"}]]);
export const QrCode = makeIcon("qr-code", [["rect",{"width":"5","height":"5","x":"3","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"16","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"3","y":"16","rx":"1"}],["path",{"d":"M21 16h-3a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 21v.01"}],["path",{"d":"M12 7v3a2 2 0 0 1-2 2H7"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M12 3h.01"}],["path",{"d":"M12 16v.01"}],["path",{"d":"M16 12h1"}],["path",{"d":"M21 12v.01"}],["path",{"d":"M12 21v-1"}]]);
export const Quote = makeIcon("quote", [["path",{"d":"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}],["path",{"d":"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}]]);
export const RotateCcw = makeIcon("rotate-ccw", [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]]);
export const ScrollText = makeIcon("scroll-text", [["path",{"d":"M15 12h-5"}],["path",{"d":"M15 8h-5"}],["path",{"d":"M19 17V5a2 2 0 0 0-2-2H4"}],["path",{"d":"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"}]]);
export const Shield = makeIcon("shield", [["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}]]);
export const SkipBack = makeIcon("skip-back", [["path",{"d":"M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"}],["path",{"d":"M3 20V4"}]]);
export const SkipForward = makeIcon("skip-forward", [["path",{"d":"M21 4v16"}],["path",{"d":"M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"}]]);
export const Smartphone = makeIcon("smartphone", [["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]]);
export const Sparkles = makeIcon("sparkles", [["path",{"d":"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"}],["path",{"d":"M20 2v4"}],["path",{"d":"M22 4h-4"}],["circle",{"cx":"4","cy":"20","r":"2"}]]);
export const Users = makeIcon("users", [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]]);
export const Volume2 = makeIcon("volume-2", [["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["path",{"d":"M16 9a5 5 0 0 1 0 6"}],["path",{"d":"M19.364 18.364a9 9 0 0 0 0-12.728"}]]);
export const VolumeX = makeIcon("volume-x", [["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["line",{"x1":"22","x2":"16","y1":"9","y2":"15"}],["line",{"x1":"16","x2":"22","y1":"9","y2":"15"}]]);
export const X = makeIcon("x", [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]]);
export const ZoomIn = makeIcon("zoom-in", [["circle",{"cx":"11","cy":"11","r":"8"}],["line",{"x1":"21","x2":"16.65","y1":"21","y2":"16.65"}],["line",{"x1":"11","x2":"11","y1":"8","y2":"14"}],["line",{"x1":"8","x2":"14","y1":"11","y2":"11"}]]);
