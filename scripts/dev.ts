// Dev server: rebuilds index.html when src/, scripts/ or assets/ change and reloads open tabs.
import { watch } from "node:fs";
import { networkInterfaces } from "node:os";
import { buildPage } from "./build";

const port = Number(process.env.PORT ?? 3000);
const RELOAD_SCRIPT = `<script>new EventSource("/events").onmessage=()=>location.reload()</script>`;

let html = await buildPage();
const tabs = new Set<ReadableStreamDefaultController<string>>();

let pending: ReturnType<typeof setTimeout> | undefined;
const rebuild = (): void => {
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      html = await buildPage();
      for (const tab of tabs) tab.enqueue("data: reload\n\n");
    } catch (error) {
      console.error(error);
    }
  }, 50);
};
for (const dir of ["src", "scripts", "assets"]) watch(dir, { recursive: true }, rebuild);

Bun.serve({
  port,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/events") {
      let tab: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({
        start: (controller) => {
          tab = controller;
          tabs.add(tab);
        },
        cancel: () => {
          tabs.delete(tab);
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
    }
    if (pathname === "/" || pathname === "/index.html") {
      return new Response(html.replace("</body>", `${RELOAD_SCRIPT}</body>`), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    const file = Bun.file(`.${pathname}`);
    return pathname.endsWith(".svg") ? new Response(file) : new Response("not found", { status: 404 });
  },
});
const lan = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === "IPv4" && !i.internal)?.address;
console.log(`dev server on http://localhost:${port}${lan ? ` and http://${lan}:${port} (same Wi-Fi)` : ""}, watching src/, scripts/, assets/`);
