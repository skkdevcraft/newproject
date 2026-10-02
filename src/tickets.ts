/**
 * Ticket model: parse a ticket file into status, blockers, and acceptance
 * boxes, and rewrite its status or acceptance boxes in place.
 *
 * Parsing and rewriting are pure. Filesystem access is isolated in
 * `loadTickets`, which is the only function here that touches disk.
 *
 * A ticket is "malformed" when its status is missing or not one of the
 * vocabulary, or when a blocker reference cannot be understood. Malformed
 * tickets carry a non-empty `problems` list; callers fail closed and exclude
 * them from selection rather than guessing.
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const TICKET_STATUSES = [
	"ready-for-agent",
	"in-progress",
	"done",
	"blocked",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface AcceptanceBox {
	/** 0-based line index of the box in the source content. */
	readonly line: number;
	readonly checked: boolean;
	readonly text: string;
}

export interface Ticket {
	/** Canonical id derived from the filename, e.g. "01". */
	readonly id: string;
	/** Path to the ticket file, as given. */
	readonly path: string;
	/** Raw file content, kept so rewrites can preserve the rest of the file. */
	readonly content: string;
	/** Parsed status, or `null` when missing or malformed. */
	readonly status: TicketStatus | null;
	/** The status text exactly as written, useful in diagnostics. */
	readonly statusText: string | null;
	/** Canonical ids of the tickets this one is blocked by. */
	readonly blockedBy: readonly string[];
	/** Acceptance checkboxes, in file order. */
	readonly acceptance: readonly AcceptanceBox[];
	/** Non-empty when the ticket is unsafe to pick. */
	readonly problems: readonly string[];
}

const STATUS_RE = /^[ \t]*(?:\*\*)?[Ss]tatus:(?:\*\*)?[ \t]*([^\r\n]*?)[ \t]*$/m;
const BLOCKED_BY_RE =
	/^[ \t]*(?:\*\*)?[Bb]locked by:(?:\*\*)?[ \t]*([^\r\n]*?)[ \t]*$/m;
const ACCEPTANCE_RE = /^[ \t]*[-*+][ \t]+\[([ xX])\][ \t]*(.*)$/;
const TICK_CHECKED_RE = /^([ \t]*[-*+][ \t]+\[)[ ](\])/gm;

export function isTicketStatus(value: string): value is TicketStatus {
	return (TICKET_STATUSES as readonly string[]).includes(value);
}

/** Derive a canonical ticket id from a filename such as `01-foo.md`. */
export function ticketIdFromFilename(filename: string): string {
	const match = /^(\d+)/.exec(basename(filename));
	return match ? canonicalId(match[1]) : basename(filename);
}

function canonicalId(raw: string): string {
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return raw;
	return String(n).padStart(2, "0");
}

/** Compare two canonical ticket ids numerically, falling back to text. */
export function compareTicketIds(a: string, b: string): number {
	const na = Number.parseInt(a, 10);
	const nb = Number.parseInt(b, 10);
	if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
	return a.localeCompare(b);
}

function parseAcceptance(content: string): AcceptanceBox[] {
	const boxes: AcceptanceBox[] = [];
	const lines = content.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const match = ACCEPTANCE_RE.exec(lines[i]);
		if (!match) continue;
		boxes.push({
			line: i,
			checked: match[1] !== " ",
			text: match[2].trim(),
		});
	}
	return boxes;
}

function parseBlockedBy(value: string): {
	ids: string[];
	problems: string[];
} {
	const trimmed = value.trim();
	if (trimmed === "") {
		return { ids: [], problems: ["empty Blocked by field"] };
	}
	if (/^none\b/i.test(trimmed) || /^n\/?a\b/i.test(trimmed)) {
		return { ids: [], problems: [] };
	}

	const ids: string[] = [];
	const problems: string[] = [];
	// Semicolons separate references. Commas do too, but only when directly
	// followed by a reference number, so commas inside a title survive.
	const segments = trimmed.replace(/,(?=\s*\d)/g, ";").split(";");
	for (const segment of segments) {
		const reference = segment.trim();
		if (reference === "") continue;
		const match = /^(\d+)\b/.exec(reference);
		if (match) {
			ids.push(canonicalId(match[1]));
		} else {
			problems.push(`unrecognized blocker reference "${reference}"`);
		}
	}
	return { ids: [...new Set(ids)], problems };
}

/**
 * Parse a ticket file. `path` determines the ticket id; `content` is the raw
 * file text. Never throws: malformed input is reported via `problems`.
 */
export function parseTicket(path: string, content: string): Ticket {
	const id = ticketIdFromFilename(path);
	const problems: string[] = [];

	const statusMatch = STATUS_RE.exec(content);
	let status: TicketStatus | null = null;
	let statusText: string | null = null;
	if (!statusMatch) {
		problems.push("missing Status field");
	} else {
		statusText = statusMatch[1].trim();
		if (statusText === "") {
			problems.push("empty Status field");
		} else if (!isTicketStatus(statusText)) {
			problems.push(`unknown Status "${statusText}"`);
		} else {
			status = statusText;
		}
	}

	const blockedBy: string[] = [];
	const blockedMatch = BLOCKED_BY_RE.exec(content);
	if (blockedMatch) {
		const parsed = parseBlockedBy(blockedMatch[1]);
		blockedBy.push(...parsed.ids);
		problems.push(...parsed.problems);
	}

	return {
		id,
		path,
		content,
		status,
		statusText,
		blockedBy,
		acceptance: parseAcceptance(content),
		problems,
	};
}

/**
 * Read every `*.md` ticket in `dir`, sorted by canonical id. A missing or
 * unreadable directory yields an empty list.
 */
export function loadTickets(dir: string): Ticket[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT" || code === "ENOTDIR") return [];
		throw error;
	}
	return entries
		.filter((name) => name.endsWith(".md"))
		.sort((a, b) =>
			compareTicketIds(ticketIdFromFilename(a), ticketIdFromFilename(b)),
		)
		.map((name) => {
			const path = join(dir, name);
			return parseTicket(path, readFileSync(path, "utf8"));
		});
}

/**
 * Rewrite the status line, preserving everything else about the file
 * byte-for-byte. Throws if there is no status field to rewrite; callers only
 * rewrite tickets they parsed successfully.
 */
export function setStatus(content: string, status: TicketStatus): string {
	const statusLine = /^([ \t]*(?:\*\*)?[Ss]tatus:(?:\*\*)?[ \t]*)[^\r\n]*$/m;
	if (!statusLine.test(content)) {
		throw new Error("ticket has no Status field to rewrite");
	}
	return content.replace(statusLine, `$1${status}`);
}

/**
 * Tick every unchecked `- [ ]` acceptance box, preserving the rest of the
 * file byte-for-byte. Already-checked boxes are left untouched.
 */
export function tickAcceptanceBoxes(content: string): string {
	return content.replace(TICK_CHECKED_RE, "$1x$2");
}

/** Return a copy of `ticket` with its status rewritten. */
export function withStatus(ticket: Ticket, status: TicketStatus): Ticket {
	return parseTicket(ticket.path, setStatus(ticket.content, status));
}

/** Return a copy of `ticket` with every acceptance box ticked. */
export function withAcceptanceChecked(ticket: Ticket): Ticket {
	return parseTicket(ticket.path, tickAcceptanceBoxes(ticket.content));
}
