/**
 * Frontier selection: which ticket should be worked next?
 *
 * Pure logic over parsed tickets. A ticket is *workable* when its status is
 * `ready-for-agent` (or `in-progress`, for crash recovery) and every ticket it
 * is blocked by is `done`. Selection walks the dependency graph smallest id
 * first, so tickets are worked in dependency order.
 *
 * Fail closed: a malformed ticket, or one whose blockers cannot be resolved,
 * is excluded and reported rather than picked.
 */

import { compareTicketIds, type Ticket } from "./tickets.ts";

export interface SkippedTicket {
	readonly ticket: Ticket;
	readonly reason: string;
}

export interface Frontier {
	/** The next ticket to work, or `null` when none is workable. */
	readonly next: Ticket | null;
	/** Every ticket that can eventually be worked, in dependency order. */
	readonly plan: readonly Ticket[];
	/** Tickets the loop must not pick, each with why. */
	readonly skipped: readonly SkippedTicket[];
}

/**
 * A ticket may be picked when it is not malformed, its status is
 * `ready-for-agent` or `in-progress`, and every blocker is `done`.
 */
export function isWorkable(
	ticket: Ticket,
	byId: ReadonlyMap<string, Ticket>,
): boolean {
	if (ticket.problems.length > 0) return false;
	if (ticket.status !== "ready-for-agent" && ticket.status !== "in-progress") {
		return false;
	}
	return ticket.blockedBy.every((id) => byId.get(id)?.status === "done");
}

/**
 * Analyze a set of tickets: pick the next workable one, lay out the full
 * dependency order for a dry run, and report what was excluded and why.
 */
export function analyzeFrontier(tickets: readonly Ticket[]): Frontier {
	const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
	const skipped: SkippedTicket[] = [];
	const candidates: Ticket[] = [];

	for (const ticket of tickets) {
		if (ticket.problems.length > 0) {
			skipped.push({ ticket, reason: ticket.problems.join("; ") });
		} else if (ticket.status === "done") {
			// Already complete; it only matters as a satisfied blocker.
		} else if (ticket.status === "blocked") {
			skipped.push({ ticket, reason: "blocked" });
		} else {
			candidates.push(ticket);
		}
	}

	// Exclude candidates whose blockers do not resolve to a known, sane ticket.
	const resolvable: Ticket[] = [];
	for (const ticket of candidates) {
		const unknown = ticket.blockedBy.filter((id) => {
			const blocker = byId.get(id);
			return !blocker || blocker.problems.length > 0;
		});
		if (unknown.length > 0) {
			skipped.push({
				ticket,
				reason: `unknown blocker(s): ${unknown.join(", ")}`,
			});
		} else {
			resolvable.push(ticket);
		}
	}

	// Topological order, smallest id first among ready tickets.
	const ordered: Ticket[] = [];
	const placed = new Set<string>();
	const sorted = [...resolvable].sort((a, b) => compareTicketIds(a.id, b.id));
	let progressed = true;
	while (progressed) {
		progressed = false;
		for (const ticket of sorted) {
			if (placed.has(ticket.id)) continue;
			const ready = ticket.blockedBy.every((id) => {
				const blocker = byId.get(id);
				return blocker?.status === "done" || placed.has(id);
			});
			if (ready) {
				ordered.push(ticket);
				placed.add(ticket.id);
				progressed = true;
			}
		}
	}
	for (const ticket of sorted) {
		if (placed.has(ticket.id)) continue;
		const pending = ticket.blockedBy.filter((id) => {
			const blocker = byId.get(id);
			return blocker?.status !== "done" && !placed.has(id);
		});
		skipped.push({
			ticket,
			reason:
				pending.length > 0
					? `dependency not satisfiable: ${pending.join(", ")}`
					: "unresolvable dependency cycle",
		});
	}

	const next = ordered.find((ticket) => isWorkable(ticket, byId)) ?? null;
	return { next, plan: ordered, skipped };
}

/** The next workable ticket, or `null`. */
export function nextTicket(tickets: readonly Ticket[]): Ticket | null {
	return analyzeFrontier(tickets).next;
}

/** All workable-now-or-later tickets in dependency order, for `--dry-run`. */
export function planOrder(tickets: readonly Ticket[]): readonly Ticket[] {
	return analyzeFrontier(tickets).plan;
}
