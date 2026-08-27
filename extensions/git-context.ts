import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (_event, ctx) => {
    try {
      execSync("git rev-parse --git-dir", { cwd: ctx.cwd, stdio: "ignore" });
      const status = execSync("git status --short", {
        cwd: ctx.cwd,
        encoding: "utf8",
      }).trim();
      if (!status) return;
      return {
        message: {
          customType: "git-context",
          content: `Git working tree status:\n${status}`,
          display: false,
        },
      };
    } catch {}
  });
}
