import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const geometryPath = path.join(packageDirectory, "src/styles/geometry.css");
const componentsPath = path.join(packageDirectory, "src/styles/components.css");
const geometry = await fs.readFile(geometryPath, "utf8");
const components = await fs.readFile(componentsPath, "utf8");

const primitiveFallbacks = new Map([
  ["--gt-primitive-color-grey-800", "#343a40"],
  ["--gt-primitive-color-grey-700", "#495057"],
  ["--gt-primitive-color-grey-500", "#adb5bd"],
  ["--gt-primitive-color-grey-400", "#ced4da"],
  ["--gt-primitive-color-navy-900", "#1a202d"],
  ["--gt-primitive-color-primary-600", "#0042d4"],
  ["--gt-primitive-color-secondary-600", "#35bf83"],
  ["--gt-primitive-color-secondary-100", "#dff9ee"],
  ["--gt-primitive-color-scarlet-50", "#fff1f1"],
  ["--gt-primitive-color-gold-400", "#ffc24d"],
  ["--gt-primitive-color-gold-50", "#fff7e8"],
  ["--gt-primitive-color-grape-700", "#5014d0"],
  ["--gt-primitive-color-grape-50", "#f8f5ff"],
  ["--gt-primitive-color-iris-tint", "rgb(68 79 229 / 0.1255)"],
  ["--gt-primitive-color-slate-200", "#e2e8f0"],
  ["--gt-primitive-color-slate-950", "#020618"],
  ["--gt-primitive-color-charcoal-500", "#333333"],
  ["--gt-primitive-color-neutral-950", "#12161f"],
  ["--gt-primitive-shadow-sheet", "0px 25px 50px -12px rgb(0 0 0 / 0.25)"],
  ["--gt-primitive-shadow-badge", "0px 2px 4px 0px rgb(0 0 0 / 0.15)"],
  ["--gt-primitive-color-azure-tint-200", "rgb(207 219 255 / 0.34)"],
  ["--gt-primitive-color-azure-tint-100", "rgb(235 243 255 / 0.34)"],
]);

for (const [primitive, fallback] of primitiveFallbacks) {
  assert.ok(
    geometry.includes(`var(${primitive}, ${fallback})`),
    `${primitive} must retain the authenticated literal fallback ${fallback}`,
  );
}

assert.doesNotMatch(
  geometry,
  /var\(--gt-primitive-[^,()]+\)/u,
  "primitive reads must never be unresolved",
);
assert.match(
  geometry,
  /--shadow-control:[\s\S]*var\(--gt-primitive-color-neutral-950, #12161f\)/u,
);
assert.match(
  geometry,
  /--shadow-dialog:[\s\S]*var\(--gt-primitive-color-neutral-950, #12161f\)/u,
);
assert.match(
  geometry,
  /--shadow-raised:[\s\S]*var\(--gt-primitive-color-neutral-950, #12161f\)/u,
);
assert.match(
  geometry,
  /--shadow-sheet: var\(--gt-primitive-shadow-sheet, 0px 25px 50px -12px rgb\(0 0 0 \/ 0\.25\)\)/u,
);
assert.match(
  geometry,
  /--shadow-badge: var\(--gt-primitive-shadow-badge, 0px 2px 4px 0px rgb\(0 0 0 \/ 0\.15\)\)/u,
);
assert.doesNotMatch(
  components,
  /shadow-card/u,
  "sheet and badge must not alias a card shadow",
);

for (const declaration of components.matchAll(/box-shadow:\s*([^;]+);/gu)) {
  assert.doesNotMatch(
    declaration[1],
    /var\(--foreground\)|color-mix/iu,
    "component shadows must use semantic roles",
  );
}
for (const semanticRole of ["control", "dialog"]) {
  assert.match(
    components,
    new RegExp(
      `var\\(--ui-shadow-${semanticRole}, var\\(--shadow-${semanticRole}\\)\\)`,
    ),
  );
}

const shadowValues = {
  control:
    "0 2px 5px 1px rgb(18 22 31 / 3%), 0 2px 3px -2px rgb(18 22 31 / 15%)",
  dialog:
    "0 4px 5px -2px rgb(18 22 31 / 5%), 0 6px 25px 2px rgb(18 22 31 / 6%)",
  raised:
    "0 6px 7px -4px rgb(18 22 31 / 5%), 0 10px 32px 4px rgb(18 22 31 / 10%)",
};

function splitShadowList(value) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth -= 1;
    if (value[index] === "," && depth === 0) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result;
}

function normalizeShadowColor(color) {
  const srgb = color.match(
    /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)\)$/u,
  );
  if (srgb) {
    const channels = srgb
      .slice(1, 4)
      .map((channel) => Math.round(Number(channel) * 255));
    return `rgb(${channels.join(" ")} / ${Number(srgb[4]) * 100}%)`;
  }
  const rgba = color.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/u);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`;
  const rgb = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/u);
  if (rgb) return `rgb(${rgb[1]} ${rgb[2]} ${rgb[3]})`;
  return color;
}

function normalizeShadow(value) {
  return splitShadowList(value)
    .map((segment) => {
      const colorMatch = segment.match(/(color\(srgb [^)]+\)|rgba?\([^)]+\))/u);
      assert.ok(
        colorMatch,
        `shadow segment has no serialised colour: ${segment}`,
      );
      const offsets =
        `${segment.slice(0, colorMatch.index)}${segment.slice(colorMatch.index + colorMatch[0].length)}`
          .trim()
          .replace(/(?<!\d)0px\b/gu, "0");
      return `${offsets} ${normalizeShadowColor(colorMatch[0])}`;
    })
    .join(", ");
}

const tokens = `
  :root {
    --gt-primitive-color-neutral-950: #12161f;
    --gt-primitive-shadow-sheet: 0px 25px 50px -12px rgb(0 0 0 / 0.25);
    --gt-primitive-shadow-badge: 0px 2px 4px 0px rgb(0 0 0 / 0.15);
    --foreground: #ff0000;
  }
`;
const probes = `
  <button id="control" data-slot="button" data-variant="default">Control</button>
  <div id="dialog" data-slot="dialog-content">Dialog</div>
  <div id="raised" class="raised">Raised</div>
  <div id="sheet" class="sheet-shadow">Sheet</div>
  <div id="badge" class="badge-shadow">Badge</div>
  <div id="semantic" class="shadow-probe">Semantic</div>
  <div id="ui" class="shadow-probe">UI</div>
  <div id="text" class="text-probe">Text</div>
`;
const probeStyle = `
  .raised { box-shadow: var(--ui-shadow-raised, var(--shadow-raised)); }
  .sheet-shadow { box-shadow: var(--shadow-sheet); }
  .badge-shadow { box-shadow: var(--shadow-badge); }
  .shadow-probe { box-shadow: var(--ui-shadow-control, var(--shadow-control)); }
  #semantic { --shadow-control: 0 0 0 0 rgb(1 2 3); }
  #ui { --shadow-control: 0 0 0 0 rgb(1 2 3); --ui-shadow-control: 0 0 0 0 rgb(4 5 6); }
  .text-probe { color: var(--color-text-strong); }
`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.setContent(
    `<style>${tokens}</style><style>${geometry}</style><style>${components}</style><style>${probeStyle}</style>${probes}`,
  );

  const computed = async (id, property) =>
    page
      .locator(`#${id}`)
      .evaluate(
        (element, name) =>
          getComputedStyle(element).getPropertyValue(name).trim(),
        property,
      );
  assert.equal(
    normalizeShadow(await computed("control", "box-shadow")),
    shadowValues.control,
    "control shadow must use neutral-950",
  );
  assert.equal(
    normalizeShadow(await computed("dialog", "box-shadow")),
    shadowValues.dialog,
    "dialog shadow must use neutral-950",
  );
  assert.equal(
    normalizeShadow(await computed("raised", "box-shadow")),
    shadowValues.raised,
    "raised shadow must use neutral-950",
  );
  assert.equal(
    normalizeShadow(await computed("semantic", "box-shadow")),
    "0 0 0 0 rgb(1 2 3)",
    "semantic shadow override must work",
  );
  assert.equal(
    normalizeShadow(await computed("ui", "box-shadow")),
    "0 0 0 0 rgb(4 5 6)",
    "UI shadow override must win",
  );
  assert.equal(
    await computed("text", "color"),
    "rgb(52, 58, 64)",
    "missing token stylesheet must use the literal colour fallback",
  );
  assert.equal(
    normalizeShadow(await computed("sheet", "box-shadow")),
    "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    "sheet shadow must remain independent",
  );
  assert.equal(
    normalizeShadow(await computed("badge", "box-shadow")),
    "0 2px 4px 0 rgba(0, 0, 0, 0.15)",
    "badge shadow must remain independent",
  );
} finally {
  await browser.close();
}

console.log("invest-shell-css-contract-pass");
