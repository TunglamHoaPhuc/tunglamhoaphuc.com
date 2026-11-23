import { redirect } from "next/navigation";

// V3 has no list page of its own for the study calendar: the calendar is a section of the home page. The menu's "Lịch tu học"
// (a link the admin keeps at /lich-tu-hoc) leads there instead of to a 404; each event still has its page at /lich-tu-hoc/<slug>.
export default function LichTuHocIndex(): never {
	redirect("/#lich-tu-hoc");
}
