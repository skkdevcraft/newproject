/**
 * The single model seam.
 *
 * All deterministic orchestration in `src/` depends on these types only.
 * The SDK-backed implementation lives near the extension entry
 * (`extensions/loop.ts`); tests substitute a fake `RunStep`.
 *
 * Keep this module free of runtime code and of any SDK import so the core
 * stays testable and the seam stays the one place a model is called.
 */

export type StepRole = "implement" | "verify";

export interface StepInput {
	readonly feature: string;
	/** Absolute path to the ticket being worked. */
	readonly ticketPath: string;
	/** Set for verify steps: the commit the diff is measured against. */
	readonly baseCommit?: string;
	readonly cwd: string;
	/** Model override. Inherited from the parent session when omitted. */
	readonly model?: string;
}

export type StepVerdict = "PASS" | "FAIL";

export interface StepResult {
	/** Whether the step ran to a usable conclusion. */
	readonly ok: boolean;
	/** Parsed from a verify session's final text; `undefined` for implement steps. */
	readonly verdict?: StepVerdict;
	readonly finalText: string;
	readonly sessionId: string;
}

export type RunStep = (role: StepRole, input: StepInput) => Promise<StepResult>;
