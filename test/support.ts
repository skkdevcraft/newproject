import { parseTicket, type Ticket } from "../src/tickets.ts";

export interface TicketOptions {
	/** `undefined` uses the default status; `null` omits the field. */
	status?: string | null;
	/** `undefined` uses "None"; `null` omits the field. */
	blockedBy?: string | null;
	boxes?: string[];
}

/** Build realistic ticket text for tests. */
export function ticketText(options: TicketOptions = {}): string {
	const status = options.status === undefined ? "ready-for-agent" : options.status;
	const blockedBy =
		options.blockedBy === undefined
			? "None — can start immediately."
			: options.blockedBy;
	const boxes = options.boxes ?? ["first criterion", "second criterion"];

	const lines: string[] = ["# Ticket", "", "**What to build:** a thing.", ""];
	if (blockedBy !== null) lines.push(`**Blocked by:** ${blockedBy}`, "");
	if (status !== null) lines.push(`**Status:** ${status}`, "");
	for (const box of boxes) lines.push(`- [ ] ${box}`);
	lines.push("");
	return lines.join("\n");
}

export function makeTicket(id: string, options: TicketOptions = {}): Ticket {
	return parseTicket(`/tickets/${id}-test.md`, ticketText(options));
}
