import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      return { block: true };
    }
  });
}
