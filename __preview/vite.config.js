import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
const root = path.resolve(import.meta.dirname, "..")
export default defineConfig({
  root, plugins: [react(), tailwindcss()],
  server: { host: true, port: 5199 },
  resolve: { alias: [
    { find: /^\.\.\/supabase$/, replacement: path.join(root, "__preview/supabaseStub.js") },
    { find: /^\.\.\/subscription$/, replacement: path.join(root, "__preview/subscriptionStub.jsx") },
  ] },
})
