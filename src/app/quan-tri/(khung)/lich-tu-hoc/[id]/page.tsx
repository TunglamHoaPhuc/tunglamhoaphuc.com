"use client";

import { useParams } from "next/navigation";
import { EventForm } from "@/components/admin/special/EventForm";

export default function EventPage() {
	const params = useParams<{ id: string }>();
	const id = Array.isArray(params.id) ? params.id[0] : params.id;
	return <EventForm key={id} id={id} />;
}
