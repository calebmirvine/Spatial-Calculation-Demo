import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function githubPagesBase() {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
  if (!owner || !repo || repo === `${owner}.github.io`) return "/";
  return `/${repo}/`;
}

export default defineConfig({
  base: githubPagesBase(),
  plugins: [react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["web-ifc", "@thatopen/fragments"],
  },
});
