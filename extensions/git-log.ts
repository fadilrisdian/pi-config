import { execSync } from "node:child_process";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("gitlog", {
    description: "Show the last 20 commits in the current repo",
    handler: async (_args, ctx) => {
      try {
        execSync("git rev-parse --git-dir", { cwd: ctx.cwd, stdio: "ignore" });
        const log = execSync("git log --oneline -20", {
          cwd: ctx.cwd,
          encoding: "utf8",
        }).trim();
        pi.sendUserMessage(`Recent commits:\n\n${log || "No commits yet."}`);
      } catch {
        ctx.ui.notify("Not a git repository.", "error");
      }
    },
  });

  pi.registerTool({
    name: "git_log",
    description:
      "Get the recent git commit history for the current repo. Use when asked about recent commits, what changed, or commit history.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      try {
        const log = execSync("git log --oneline -20", {
          cwd: ctx.cwd,
          encoding: "utf8",
        }).trim();
        return { content: [{ type: "text", text: log || "No commits yet." }] };
      } catch {
        return { content: [{ type: "text", text: "Not a git repository." }] };
      }
    },
  });
}
