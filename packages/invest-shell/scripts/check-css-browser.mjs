import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const packageDirectory = path.resolve(
  process.env.CSS_CONTRACT_PACKAGE_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const geometry = await fs.readFile(path.join(packageDirectory, "src/styles/geometry.css"), "utf8");
const components = await fs.readFile(path.join(packageDirectory, "src/styles/components.css"), "utf8");
const shadowValues = {
  control: "0 2px 5px 1px rgb(18 22 31 / 3%), 0 2px 3px -2px rgb(18 22 31 / 15%)",
  dialog: "0 4px 5px -2px rgb(18 22 31 / 5%), 0 6px 25px 2px rgb(18 22 31 / 6%)",
  raised: "0 6px 7px -4px rgb(18 22 31 / 5%), 0 10px 32px 4px rgb(18 22 31 / 10%)",
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
  const srgb = color.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)\)$/u);
  if (srgb) {
    const channels = srgb.slice(1, 4).map(channel => Math.round(Number(channel) * 255));
    return `rgb(${channels.join(" ")} / ${Number(srgb[4]) * 100}%)`;
  }
  const rgba = color.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/u);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`;
  const rgb = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/u);
  if (rgb) return `rgb(${rgb[1]} ${rgb[2]} ${rgb[3]})`;
  return color;
}

function normalizeShadow(value) {
  return splitShadowList(value).map(segment => {
    const colorMatch = segment.match(/(color\(srgb [^)]+\)|rgba?\([^)]+\))/u);
    assert.ok(colorMatch, `shadow segment has no serialised colour: ${segment}`);
    const offsets = `${segment.slice(0, colorMatch.index)}${segment.slice(colorMatch.index + colorMatch[0].length)}`
      .trim().replace(/(?<!\d)0px\b/gu, "0");
    return `${offsets} ${normalizeShadowColor(colorMatch[0])}`;
  }).join(", ");
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

const report = {
  schemaVersion: 1,
  package: "@global-torque/invest-shell",
  packageDirectory: path.basename(packageDirectory),
  playwright: "1.63.0",
  result: "fail",
  checks: [],
};
const browser = await chromium.launch({ headless: true });
try {
  report.chromium = await browser.version();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(`<style>${tokens}</style><style>${geometry}</style><style>${components}</style><style>${probeStyle}</style>${probes}`);
  const computed = async (id, property) => page.locator(`#${id}`).evaluate((element, name) => getComputedStyle(element).getPropertyValue(name).trim(), property);
  const checks = [
    ["control-shadow", normalizeShadow(await computed("control", "box-shadow")), shadowValues.control],
    ["dialog-shadow", normalizeShadow(await computed("dialog", "box-shadow")), shadowValues.dialog],
    ["raised-shadow", normalizeShadow(await computed("raised", "box-shadow")), shadowValues.raised],
    ["semantic-shadow-override", normalizeShadow(await computed("semantic", "box-shadow")), "0 0 0 0 rgb(1 2 3)"],
    ["ui-shadow-override", normalizeShadow(await computed("ui", "box-shadow")), "0 0 0 0 rgb(4 5 6)"],
    ["literal-colour-fallback", await computed("text", "color"), "rgb(52, 58, 64)"],
    ["sheet-shadow", normalizeShadow(await computed("sheet", "box-shadow")), "0 25px 50px -12px rgba(0, 0, 0, 0.25)"],
    ["badge-shadow", normalizeShadow(await computed("badge", "box-shadow")), "0 2px 4px 0 rgba(0, 0, 0, 0.15)"],
  ];
  for (const [name, actual, expected] of checks) {
    assert.equal(actual, expected, `${name} computed value mismatch`);
    report.checks.push({ name, result: "pass", value: actual });
  }
  report.result = "pass";
} finally {
  await browser.close();
}

const reportPath = process.env.CSS_BROWSER_REPORT;
if (reportPath) await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
const reportDigest = crypto.createHash("sha256").update(JSON.stringify(report)).digest("hex");
console.log(`invest-shell-css-browser-pass ${reportDigest}`);
