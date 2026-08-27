/**
 * Custom Header Extension
 *
 * Replaces the built-in startup header with an identical copy you can customize.
 * Edit the `buildHeader()` function below to change what's shown at startup.
 *
 * Usage: Just edit this file and run /reload in pi.
 * To restore the built-in header: rename/delete this file and /reload.
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";

/**
 * A single keybinding hint: [key, description].
 * `key` is the literal key text, `desc` is what it does.
 */
type Hint = [key: string, desc: string];

/**
 * Build a two-column, bordered table from the hints.
 * Each row shows two "Key | Action" pairs, maximizing the horizontal space
 * available to each pair so descriptions are shown in full when possible.
 * The table width and all column widths are derived from the terminal width.
 */
function buildTable(theme: Theme, hints: Hint[], width: number): string[] {
	if (hints.length === 0) return [];

	const maxKeyLen = Math.max(...hints.map(h => h[0].length));

	// Two Key+Action pairs per row (readability over density).
	const cols = Math.min(2, hints.length);

	// Derive a uniform column width from the available terminal width, distributing
	// any leftover so the table fills `width` exactly:
	//   width = cols*colW + (cols-1) (separators) + 2 (borders)
	const base = Math.floor((width - cols - 1) / cols);
	const leftover = width - cols - 1 - base * cols;
	const colW = Array.from({ length: cols }, (_, c) => base + (c < leftover ? 1 : 0));

	// Fill column-major so the first column is fully populated before the next.
	const rows = Math.ceil(hints.length / cols);
	const columns: Hint[][] = [];
	for (let c = 0; c < cols; c++) {
		columns.push(hints.slice(c * rows, (c + 1) * rows));
	}

	// Align every key to the same width so keys line up across all groups.
	// A cell is exactly `w` chars: 1 pad + key + 2 gap + desc + 1 pad.
	const keyW = maxKeyLen;
	const descPad = (w: number) => w - keyW - 4;
	const cell = (k: string, d: string, w: number) => {
		const dp = descPad(w);
		// Truncate the description (with an ellipsis) if it would overflow the column,
		// so content never spills past the column border.
		const dd = d.length > dp ? d.slice(0, Math.max(0, dp - 1)) + "…" : d;
		return ` ${theme.fg("dim", k.padEnd(keyW))}  ${theme.fg("muted", dd.padEnd(dp))} `;
	};

	// Same computed column width drives the outer border and every separator.
	const border = (left: string, mid: string, right: string) =>
		left + colW.map(w => "─".repeat(w)).join(mid) + right;
	const top = border("┌", "┬", "┐");
	const mid = border("├", "┼", "┤");
	const bot = border("└", "┴", "┘");

	const headerRow =
		theme.fg("dim", "│") +
		colW.map(w =>
			` ${theme.fg("accent", "Key".padEnd(keyW))}  ${theme.fg("accent", "Action".padEnd(descPad(w)))} `,
		).join(theme.fg("dim", "│")) +
		theme.fg("dim", "│");

	const body: string[] = [theme.fg("dim", top), headerRow, theme.fg("dim", mid)];
	for (let r = 0; r < rows; r++) {
		const cells = columns.map((col, c) => {
			const hint = col[r];
			if (!hint) return cell("", "", colW[c]);
			return cell(hint[0], hint[1], colW[c]);
		});
		body.push(theme.fg("dim", "│" + cells.join(theme.fg("dim", "│")) + "│"));
	}
	body.push(theme.fg("dim", bot));
	return body;
}

/**
 * Build the header text. This is what you customize.
 *
 * Currently shows:
 *   - The logo
 *   - A table of keybinding hints
 */
function buildHeader(theme: Theme, width: number): string {
	// ── Logo ──────────────────────────────────────────────
	// Change this to whatever you want as the title line.
	const ascii_art_2 = [
		"   ███████████████████████████╗  ",
		"   ╚══██████╔════════██████╔══╝  ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"   ████████████╗  ████████████╗  ",
		"   ╚═══════════╝  ╚═══════════╝  ",
	].map(line => theme.bold(theme.fg("success", line))).join("\n");

	const logo =
		"\n" + ascii_art_2 + "\n\n" +
		theme.bold(theme.fg("accent", "pi")) +
		theme.fg("dim", ` v${VERSION}`);

	// ── Keybinding hints ─────────────────────────────────
	// Each entry is [key, description]. Remove, reorder, or add your own.
	const hints: Hint[] = [
		["escape", "to interrupt"],
		["ctrl+c", "to clear"],
		["ctrl+c twice", "to exit"],
		["ctrl+d", "to exit (empty)"],
		["ctrl+z", "to suspend"],
		["ctrl+u", "to delete to end"],
		["shift+tab", "to cycle thinking level"],
		["ctrl+p/shift+ctrl+p", "to cycle models"],
		["ctrl+l", "to select model"],
		["ctrl+o", "to expand tools"],
		["ctrl+t", "to expand thinking"],
		["ctrl+g", "for external editor"],
		["/", "for commands"],
		["!", "to run bash"],
		["!!", "to run bash (no context)"],
		["alt+enter", "to queue follow-up"],
		["alt+up", "to edit all queued messages"],
		[process.platform === "win32" ? "alt+v" : "ctrl+v", "to paste image"],
		["drop files", "to attach"],
	];

	const table = buildTable(theme, hints, width);
	return `${logo}\n\n${table.join("\n")}`;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setHeader((_tui, theme) => ({
			render(width: number): string[] {
				return buildHeader(theme, width).split("\n");
			},
			invalidate() {},
		}));
	});

	// Command to restore the built-in header
	pi.registerCommand("builtin-header", {
		description: "Restore the built-in startup header",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in header restored", "info");
		},
	});
}
