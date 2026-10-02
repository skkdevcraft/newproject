import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
	loadTickets,
	parseTicket,
	setStatus,
	tickAcceptanceBoxes,
	ticketIdFromFilename,
	withAcceptanceChecked,
	withStatus,
} from "../src/tickets.ts";
import { ticketText } from "./support.ts";

const PATH = "/tickets/01-ticket-model.md";

test("parses status, blockers, and acceptance boxes", () => {
	const content = ticketText({
		status: "ready-for-agent",
		blockedBy: "01 — foundation; 02 — middle",
		boxes: ["reads files", "writes files"],
	});

	const ticket = parseTicket(PATH, content);

	assert.equal(ticket.id, "01");
	assert.equal(ticket.status, "ready-for-agent");
	assert.equal(ticket.statusText, "ready-for-agent");
	assert.deepEqual(ticket.blockedBy, ["01", "02"]);
	assert.equal(ticket.acceptance.length, 2);
	assert.deepEqual(
		ticket.acceptance.map((box) => box.text),
		["reads files", "writes files"],
	);
	assert.deepEqual(
		ticket.acceptance.map((box) => box.checked),
		[false, false],
	);
	assert.deepEqual(ticket.problems, []);
});

test("treats a None blocker line as unblocked", () => {
	const ticket = parseTicket(
		PATH,
		ticketText({ blockedBy: "None — can start immediately." }),
	);
	assert.deepEqual(ticket.blockedBy, []);
	assert.deepEqual(ticket.problems, []);
});

test("canonicalizes unpadded blocker references", () => {
	const ticket = parseTicket(PATH, ticketText({ blockedBy: "1, 2" }));
	assert.deepEqual(ticket.blockedBy, ["01", "02"]);
});

test("keeps commas inside a blocker title", () => {
	const ticket = parseTicket(
		PATH,
		ticketText({ blockedBy: "01 — Tickets, models; 02 — Git" }),
	);
	assert.deepEqual(ticket.blockedBy, ["01", "02"]);
	assert.deepEqual(ticket.problems, []);
});

test("detects already-checked acceptance boxes", () => {
	const content = ticketText({ boxes: [] }).replace(
		"**Status:** ready-for-agent",
		"- [x] already done\n- [ ] still todo",
	);
	const ticket = parseTicket(PATH, content);

	assert.deepEqual(
		ticket.acceptance.map((box) => box.checked),
		[true, false],
	);
});

test("reports a missing status as malformed", () => {
	const ticket = parseTicket(PATH, ticketText({ status: null }));
	assert.equal(ticket.status, null);
	assert.match(ticket.problems.join(" "), /missing Status/);
});

test("reports an unknown status as malformed", () => {
	const ticket = parseTicket(PATH, ticketText({ status: "doing" }));
	assert.equal(ticket.status, null);
	assert.match(ticket.problems.join(" "), /unknown Status "doing"/);
});

test("reports an empty status as malformed", () => {
	const ticket = parseTicket(PATH, ticketText({ status: "" }));
	assert.equal(ticket.status, null);
	assert.match(ticket.problems.join(" "), /empty Status/);
});

test("reports an unrecognized blocker reference", () => {
	const ticket = parseTicket(PATH, ticketText({ blockedBy: "the first ticket" }));
	assert.deepEqual(ticket.blockedBy, []);
	assert.match(ticket.problems.join(" "), /unrecognized blocker reference/);
});

test("reports an empty Blocked by field", () => {
	const ticket = parseTicket(PATH, ticketText({ blockedBy: "" }));
	assert.match(ticket.problems.join(" "), /empty Blocked by/);
});

test("derives the id from the filename", () => {
	assert.equal(ticketIdFromFilename("/x/07-something.md"), "07");
	assert.equal(ticketIdFromFilename("3-other.md"), "03");
	assert.equal(ticketIdFromFilename("no-number.md"), "no-number.md");
});

test("status rewrite preserves the rest of the file unchanged", () => {
	const content = ticketText({ status: "ready-for-agent" });
	const updated = setStatus(content, "in-progress");

	const before = content.split("\n");
	const after = updated.split("\n");
	assert.equal(after.length, before.length);
	for (let i = 0; i < before.length; i++) {
		if (before[i].includes("Status:")) continue;
		assert.equal(after[i], before[i], `line ${i} changed unexpectedly`);
	}
	assert.match(updated, /\*\*Status:\*\* in-progress/);
});

test("ticking boxes preserves the rest of the file unchanged", () => {
	const content = ticketText({ boxes: [] }).replace(
		"**Status:** ready-for-agent",
		"- [x] already done\n- [ ] first\n- [ ] second",
	);
	const updated = tickAcceptanceBoxes(content);

	assert.match(updated, /- \[x\] already done/);
	assert.match(updated, /- \[x\] first/);
	assert.match(updated, /- \[x\] second/);

	const before = content.split("\n");
	const after = updated.split("\n");
	assert.equal(after.length, before.length);
	for (let i = 0; i < before.length; i++) {
		const isBox = /^\s*- \[[ xX]\]/.test(before[i]);
		if (isBox) continue;
		assert.equal(after[i], before[i], `line ${i} changed unexpectedly`);
	}
});

test("withStatus and withAcceptanceChecked return re-parsed tickets", () => {
	const ticket = parseTicket(PATH, ticketText({ status: "ready-for-agent" }));

	const progressed = withStatus(ticket, "done");
	assert.equal(progressed.status, "done");
	assert.equal(progressed.id, ticket.id);

	const checked = withAcceptanceChecked(progressed);
	assert.equal(checked.status, "done");
	assert.ok(checked.acceptance.every((box) => box.checked));
});

test("setStatus throws when there is no status field", () => {
	const content = ticketText({ status: null });
	assert.throws(() => setStatus(content, "done"), /no Status field/);
});

test("loadTickets reads and sorts ticket files by id", () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-loop-tickets-"));
	try {
		writeFileSync(join(dir, "10-later.md"), ticketText({ status: "done" }));
		writeFileSync(join(dir, "2-middle.md"), ticketText({ status: "ready-for-agent" }));
		writeFileSync(join(dir, "01-first.md"), ticketText({ status: "ready-for-agent" }));
		writeFileSync(join(dir, "notes.txt"), "not a ticket");

		const tickets = loadTickets(dir);
		assert.deepEqual(
			tickets.map((ticket) => ticket.id),
			["01", "02", "10"],
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("loadTickets returns an empty list for a missing directory", () => {
	assert.deepEqual(loadTickets("/does/not/exist"), []);
});
