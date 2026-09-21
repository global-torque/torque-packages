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
const footerPaths = [
  "src/components/VFooter/VFooter.vue",
  "src/components/VFooter/VFooterBottom.vue",
  "src/components/VFooter/VFooterMenu.vue",
  "src/components/VFooter/VFooterText.vue",
  "src/pwa/PWAFooterMenu.vue",
].map((relativePath) => path.join(packageDirectory, relativePath));
const footerSource = (await Promise.all(footerPaths.map((footerPath) => fs.readFile(footerPath, "utf8")))).join("\n");
for (const contract of [
  "var(--ui-color-surface-inverse, var(--foreground))",
  "var(--ui-color-text-inverse, var(--background))",
  "var(--ui-color-text-disabled, var(--foreground))",
  "var(--muted-foreground)",
  "var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary)))",
  "var(--ui-color-accent-inverse, var(--primary))",
  "var(--ui-color-surface, var(--background))",
  "var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted))",
]) {
  assert.ok(footerSource.includes(contract), `footer source contract is missing: ${contract}`);
}
assert.doesNotMatch(footerSource, /#12161f|#fff|#004fff/u, "footer source must not contain local color literals");
const shadowValues = {
  redControl: "0 2px 5px 1px rgb(255 0 0 / 3%), 0 2px 3px -2px rgb(255 0 0 / 15%)",
  greenControl: "0 2px 5px 1px rgb(0 255 0 / 3%), 0 2px 3px -2px rgb(0 255 0 / 15%)",
  redDialog: "0 4px 5px -2px rgb(255 0 0 / 5%), 0 6px 25px 2px rgb(255 0 0 / 6%)",
  greenDialog: "0 4px 5px -2px rgb(0 255 0 / 5%), 0 6px 25px 2px rgb(0 255 0 / 6%)",
  redRaised: "0 6px 7px -4px rgb(255 0 0 / 5%), 0 10px 32px 4px rgb(255 0 0 / 10%)",
  greenRaised: "0 6px 7px -4px rgb(0 255 0 / 5%), 0 10px 32px 4px rgb(0 255 0 / 10%)",
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
    --gt-primitive-shadow-sheet: 0px 25px 50px -12px rgb(0 0 0 / 0.25);
    --gt-primitive-shadow-badge: 0px 2px 4px 0px rgb(0 0 0 / 0.15);
    --foreground: #ff0000;
    --background: #f0e1d2;
    --primary: #654321;
    --muted-foreground: #987654;
    --color-text-disabled: #adb5bd;
    --accent: #abcdef;
    --color-surface-inverse-muted: #fedcba;
  }
`;
const footerProbeStyle = `
  :root {
    --color-text-disabled: #adb5bd;
    --color-surface-inverse-muted: #fedcba;
  }
  #footer-surface { background-color: var(--ui-color-surface-inverse, var(--foreground)); }
  #footer-text { color: var(--ui-color-text-inverse, var(--background)); }
  #footer-disabled { color: var(--ui-color-text-disabled, var(--foreground)); }
  #footer-muted { color: var(--muted-foreground); }
  #footer-accent { color: var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary))); }
  #footer-primary { color: var(--ui-color-accent-inverse, var(--primary)); }
  #pwa-surface { background-color: var(--ui-color-surface, var(--background)); }
  #pwa-muted { color: var(--muted-foreground); }
  #pwa-active { background-color: var(--accent); color: var(--foreground); }
  #pwa-label { color: var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted)); }
  #footer-overrides {
    --ui-color-surface-inverse: #101820;
    --ui-color-text-inverse: #fefefe;
    --ui-color-text-disabled: #112233;
    --ui-color-accent-inverse: #445566;
    --ui-color-surface: #ffeedd;
    --ui-color-surface-inverse-muted: #ccbbaa;
  }
  #footer-overrides .surface { background-color: var(--ui-color-surface-inverse, var(--foreground)); }
  #footer-overrides .text { color: var(--ui-color-text-inverse, var(--background)); }
  #footer-overrides .disabled { color: var(--ui-color-text-disabled, var(--foreground)); }
  #footer-overrides .accent { color: var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary))); }
  #footer-overrides .pwa-surface { background-color: var(--ui-color-surface, var(--background)); }
  #footer-overrides .pwa-label { color: var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted)); }
`;
const probes = `
  <button id="control" data-slot="button" data-variant="secondary">Control</button>
  <button id="outline" data-slot="button" data-variant="outline">Outline</button>
  <button id="ghost" data-slot="button" data-variant="ghost">Ghost</button>
  <div id="dialog" data-slot="dialog-content">Dialog</div>
  <div id="raised" class="raised">Raised</div>
  <div id="sheet" class="sheet-shadow">Sheet</div>
  <div id="badge" class="badge-shadow">Badge</div>
  <div id="semantic" class="shadow-probe">Semantic</div>
  <div id="ui" class="shadow-probe">UI</div>
  <div id="text" class="text-probe">Text</div>
  <div id="footer-surface">Footer surface</div>
  <div id="footer-text">Footer text</div>
  <div id="footer-disabled">Footer disabled</div>
  <div id="footer-muted">Footer muted</div>
  <div id="footer-accent">Footer accent</div>
  <div id="footer-primary">Footer primary</div>
  <div id="pwa-surface">PWA surface</div>
  <div id="pwa-muted">PWA muted</div>
  <div id="pwa-active">PWA active</div>
  <div id="pwa-label">PWA label</div>
  <div id="footer-overrides">
    <div id="footer-override-surface" class="surface">Override surface</div>
    <div id="footer-override-text" class="text">Override text</div>
    <div id="footer-override-disabled" class="disabled">Override disabled</div>
    <div id="footer-override-accent" class="accent">Override accent</div>
    <div id="footer-override-pwa-surface" class="pwa-surface">Override PWA surface</div>
    <div id="footer-override-pwa-label" class="pwa-label">Override PWA label</div>
  </div>
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
  await page.setContent(`<style>${tokens}</style><style>${geometry}</style><style>${components}</style><style>${footerProbeStyle}</style><style>${probeStyle}</style>${probes}`);
  const computed = async (id, property) => page.locator(`#${id}`).evaluate((element, name) => getComputedStyle(element).getPropertyValue(name).trim(), property);
  const checks = [
    ["control-shadow", normalizeShadow(await computed("control", "box-shadow")), shadowValues.redControl],
    ["outline-default", await computed("outline", "box-shadow"), "none"],
    ["ghost-default", await computed("ghost", "box-shadow"), "none"],
    ["dialog-shadow", normalizeShadow(await computed("dialog", "box-shadow")), shadowValues.redDialog],
    ["raised-shadow", normalizeShadow(await computed("raised", "box-shadow")), shadowValues.redRaised],
    ["semantic-shadow-override", normalizeShadow(await computed("semantic", "box-shadow")), "0 0 0 0 rgb(1 2 3)"],
    ["ui-shadow-override", normalizeShadow(await computed("ui", "box-shadow")), "0 0 0 0 rgb(4 5 6)"],
    ["literal-colour-fallback", await computed("text", "color"), "rgb(52, 58, 64)"],
    ["sheet-shadow", normalizeShadow(await computed("sheet", "box-shadow")), "0 25px 50px -12px rgba(0, 0, 0, 0.25)"],
    ["badge-shadow", normalizeShadow(await computed("badge", "box-shadow")), "0 2px 4px 0 rgba(0, 0, 0, 0.15)"],
    ["footer-surface-host-foreground", await computed("footer-surface", "background-color"), "rgb(255, 0, 0)"],
    ["footer-text-host-background", await computed("footer-text", "color"), "rgb(240, 225, 210)"],
    ["footer-disabled-legacy-foreground", await computed("footer-disabled", "color"), "rgb(255, 0, 0)"],
    ["footer-muted-host-muted", await computed("footer-muted", "color"), "rgb(152, 118, 84)"],
    ["footer-accent-host-primary", await computed("footer-accent", "color"), "rgb(101, 67, 33)"],
    ["footer-primary-host-primary", await computed("footer-primary", "color"), "rgb(101, 67, 33)"],
    ["pwa-surface-host-background", await computed("pwa-surface", "background-color"), "rgb(240, 225, 210)"],
    ["pwa-muted-host-muted", await computed("pwa-muted", "color"), "rgb(152, 118, 84)"],
    ["pwa-active-host-accent", await computed("pwa-active", "background-color"), "rgb(171, 205, 239)"],
    ["pwa-active-host-foreground", await computed("pwa-active", "color"), "rgb(255, 0, 0)"],
    ["pwa-label-host-inverse-muted", await computed("pwa-label", "color"), "rgb(254, 220, 186)"],
    ["footer-ui-surface-override", await computed("footer-override-surface", "background-color"), "rgb(16, 24, 32)"],
    ["footer-ui-text-override", await computed("footer-override-text", "color"), "rgb(254, 254, 254)"],
    ["footer-ui-disabled-override", await computed("footer-override-disabled", "color"), "rgb(17, 34, 51)"],
    ["footer-ui-accent-override", await computed("footer-override-accent", "color"), "rgb(68, 85, 102)"],
    ["pwa-ui-surface-override", await computed("footer-override-pwa-surface", "background-color"), "rgb(255, 238, 221)"],
    ["pwa-ui-inverse-muted-override", await computed("footer-override-pwa-label", "color"), "rgb(204, 187, 170)"],
  ];
  for (const [name, actual, expected] of checks) {
    assert.equal(actual, expected, `${name} computed value mismatch`);
    report.checks.push({ name, result: "pass", value: actual });
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--gt-primitive-color-grey-800", "#010203"));
  {
    const actual = await computed("text", "color");
    assert.equal(actual, "rgb(1, 2, 3)", "authenticated 0.3.0 primitive must win over its literal fallback");
    report.checks.push({ name: "tokens-0.3.0-primitive", result: "pass", value: actual });
  }
  await page.evaluate((foreground) => {
    document.documentElement.style.removeProperty("--gt-primitive-color-grey-800");
    document.documentElement.style.setProperty("--gt-primitive-color-grey-500", "#18181b");
    document.documentElement.style.setProperty("--color-text-disabled", foreground);
  }, "#18181b");
  {
    const actual = await computed("footer-disabled", "color");
    assert.equal(actual, "rgb(255, 0, 0)", "authenticated 0.2.1 disabled token must not change the legacy inverse fallback");
    report.checks.push({ name: "tokens-0.2.1-footer-compatibility", result: "pass", value: actual });
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--foreground", "#00ff00"));
  for (const [name, id, expected] of [
    ["control-shadow-host-foreground", "control", shadowValues.greenControl],
    ["dialog-shadow-host-foreground", "dialog", shadowValues.greenDialog],
    ["raised-shadow-host-foreground", "raised", shadowValues.greenRaised],
  ]) {
    const actual = normalizeShadow(await computed(id, "box-shadow"));
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
