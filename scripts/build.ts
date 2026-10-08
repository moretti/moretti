// Bundles src/main.ts (assets inlined as data URLs) into the single index.html that GitHub Pages serves.
import { SPRITE_SHEET_SIZES, SPRITE_SHEETS, TREX, TREX_POSES } from "../src/config";

const MIME: Record<string, string> = { ".png": "image/png", ".mp3": "audio/mpeg" };

/** Turns imported sprites and sounds into inline data URLs so the page is a single file. */
const inlineAssets: import("bun").BunPlugin = {
  name: "inline-assets",
  setup(build) {
    build.onLoad({ filter: /\.(png|mp3)$/ }, async ({ path }) => {
      const ext = path.slice(path.lastIndexOf("."));
      const data = Buffer.from(await Bun.file(path).arrayBuffer()).toString("base64");
      return { contents: `export default ${JSON.stringify(`data:${MIME[ext]};base64,${data}`)};`, loader: "js" };
    });
  },
};

/** Builds the page, writes it to index.html and returns the HTML. Throws on bundle errors. */
export async function buildPage(): Promise<string> {
  const result = await Bun.build({
    entrypoints: ["src/main.ts"],
    target: "browser",
    minify: true,
    plugins: [inlineAssets],
  });
  if (!result.success) throw new AggregateError(result.logs, "bundle failed");
  const bundle = await result.outputs[0]!.text();
  const template = await Bun.file("scripts/page.html").text();
  const html = template.replace("/*__BUNDLE__*/", () => bundle).replace("__FAVICON__", () => faviconDataUrl(sheet1x));
  await Bun.write("index.html", html);
  console.log(`index.html ${(html.length / 1024).toFixed(1)} KB (bundle ${(bundle.length / 1024).toFixed(1)} KB)`);
  return html;
}

const sheet1x = await Bun.file("assets/sprite-1x.png").arrayBuffer();

if (import.meta.main) await buildPage();

/** The running dino cropped out of the 1x sheet, as an SVG-embeddable data URL. */
function faviconDataUrl(sheet1x: ArrayBuffer): string {
  const { trex } = SPRITE_SHEETS[1];
  const { width, height } = SPRITE_SHEET_SIZES[1];
  const sheet = `data:image/png;base64,${Buffer.from(sheet1x).toString("base64")}`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${trex.x + TREX_POSES.running.frames[0]!} ${trex.y} ${TREX.width} ${TREX.height}'><image href='${sheet}' width='${width}' height='${height}'/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
