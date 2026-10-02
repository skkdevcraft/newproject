import assert from "node:assert/strict";
import { test } from "node:test";

import {
	analyzeFrontier,
	isWorkable,
	nextTicket,
	planOrder,
} from "../src/frontier.ts";
import { makeTicket } from "./support.ts";

test("picks the only ready ticket", () => {
	const tickets = [makeTicket("01", { status: "ready-for-agent" })];
	assert.equal(nextTicket(tickets)?.id, "01");
});

test("skips a ticket whose blocker is not yet done", () => {
	const tickets = [
		makeTicket("01", { status: "ready-for-agent" }),
		makeTicket("02", { status: "ready-for-agent", blockedBy: "01" }),
	];
	assert.equal(nextTicket(tickets)?.id, "01");
});

test("picks the dependent once its blocker is done", () => {
	const tickets = [
		makeTicket("01", { status: "done" }),
		makeTicket("02", { status: "ready-for-agent", blockedBy: "01" }),
	];
	assert.equal(nextTicket(tickets)?.id, "02");
});

test("treats in-progress as workable for crash recovery", () => {
	const tickets = [makeTicket("01", { status: "in-progress" })];
	assert.equal(nextTicket(tickets)?.id, "01");
});

test("excludes blocked tickets", () => {
	const tickets = [
		makeTicket("01", { status: "blocked" }),
		makeTicket("02", { status: "ready-for-agent" }),
	];
	assert.equal(nextTicket(tickets)?.id, "02");
});

test("excludes malformed tickets and reports them", () => {
	const malformed = makeTicket("01", { status: "wizardry" });
	const tickets = [
		malformed,
		makeTicket("02", { status: "ready-for-agent" }),
	];

	const frontier = analyzeFrontier(tickets);
	assert.equal(frontier.next?.id, "02");
	assert.equal(frontier.skipped.length, 1);
	assert.equal(frontier.skipped[0].ticket.id, "01");
	assert.match(frontier.skipped[0].reason, /unknown Status/);
});

test("excludes a ticket with an unknown blocker", () => {
	const tickets = [
		makeTicket("01", { status: "ready-for-agent", blockedBy: "99" }),
		makeTicket("02", { status: "ready-for-agent" }),
	];

	const frontier = analyzeFrontier(tickets);
	assert.equal(frontier.next?.id, "02");
	assert.deepEqual(
		frontier.skipped.map((entry) => entry.ticket.id),
		["01"],
	);
	assert.match(frontier.skipped[0].reason, /unknown blocker/);
});

test("orders by dependency, not by ticket id", () => {
	const tickets = [
		makeTicket("01", { status: "ready-for-agent", blockedBy: "02" }),
		makeTicket("02", { status: "ready-for-agent" }),
	];
	assert.deepEqual(
		planOrder(tickets).map((ticket) => ticket.id),
		["02", "01"],
	);
	assert.equal(nextTicket(tickets)?.id, "02");
});

test("plans the whole remaining set in order", () => {
	const tickets = [
		makeTicket("01", { status: "ready-for-agent" }),
		makeTicket("02", { status: "ready-for-agent", blockedBy: "01" }),
		makeTicket("03", { status: "ready-for-agent", blockedBy: "02" }),
		makeTicket("04", { status: "done" }),
	];

	assert.deepEqual(
		planOrder(tickets).map((ticket) => ticket.id),
		["01", "02", "03"],
	);
	assert.equal(nextTicket(tickets)?.id, "01");
});

test("reports a dependency cycle", () => {
	const tickets = [
		makeTicket("01", { status: "ready-for-agent", blockedBy: "02" }),
		makeTicket("02", { status: "ready-for-agent", blockedBy: "01" }),
	];

	const frontier = analyzeFrontier(tickets);
	assert.equal(frontier.next, null);
	assert.deepEqual(frontier.plan, []);
	assert.deepEqual(
		frontier.skipped.map((entry) => entry.ticket.id).sort(),
		["01", "02"],
	);
});

test("a blocked ticket does not unlock its dependent", () => {
	const tickets = [
		makeTicket("01", { status: "blocked" }),
		makeTicket("02", { status: "ready-for-agent", blockedBy: "01" }),
		makeTicket("03", { status: "ready-for-agent" }),
	];

	const frontier = analyzeFrontier(tickets);
	assert.equal(frontier.next?.id, "03");
	assert.ok(
		frontier.skipped.some((entry) => entry.ticket.id === "02"),
		"dependent of a blocked ticket must be excluded",
	);
});

test("isWorkable requires a done blocker", () => {
	const dep = makeTicket("01", { status: "in-progress" });
	const ticket = makeTicket("02", { status: "ready-for-agent", blockedBy: "01" });

	const inProgress = new Map([dep, ticket].map((t) => [t.id, t]));
	assert.equal(isWorkable(ticket, inProgress), false);

	const doneDep = { ...dep, status: "done" as const };
	const done = new Map([
		[doneDep.id, doneDep],
		[ticket.id, ticket],
	]);
	assert.equal(isWorkable(ticket, done), true);
});
