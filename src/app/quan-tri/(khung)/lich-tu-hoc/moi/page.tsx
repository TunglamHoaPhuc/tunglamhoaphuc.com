"use client";

import { useEffect, useState } from "react";
import { EventForm } from "@/components/admin/special/EventForm";

export default function NewEventPage() {
	// "?ngay=YYYY-MM-DD" comes from the "+ Thêm" link of the month grid.
	const [date, setDate] = useState<string | undefined>(undefined);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		// Reads the address once in the browser; the state is set after mount, not during the render.
		/* eslint-disable react-hooks/set-state-in-effect */
		setDate(new URLSearchParams(window.location.search).get("ngay") ?? undefined);
		setReady(true);
		/* eslint-enable react-hooks/set-state-in-effect */
	}, []);
	return ready ? <EventForm id={null} initialDate={date} /> : null;
}
