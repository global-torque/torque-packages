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
const footerSources = await Promise.all(footerPaths.map((footerPath) => fs.readFile(footerPath, "utf8")));
const [vFooterSource, vFooterBottomSource, , vFooterTextSource] = footerSources;
const footerSource = footerSources.join("\n");
for (const contract of [
  "var(--ui-color-surface-inverse, var(--foreground))",
  "var(--ui-color-text-inverse, var(--background))",
  "var(--ui-color-text-disabled, var(--color-text-disabled))",
  "var(--muted-foreground)",
  "var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary)))",
  "var(--ui-color-accent-inverse, var(--primary))",
  "var(--ui-color-surface, var(--background))",
  "var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted))",
]) {
  assert.ok(footerSource.includes(contract), `footer source contract is missing: ${contract}`);
}
assert.match(
  vFooterSource,
  /\.footer-bottom\s*\{[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--color-text-disabled\);/u,
  "VFooter source must preserve the legacy bottom text token",
);
assert.match(
  vFooterBottomSource,
  /\.v-footer-bottom[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--ui-color-text-disabled,\s*var\(--color-text-disabled\)\);/u,
  "VFooterBottom source must preserve the public role override and legacy host fallback",
);
assert.match(
  vFooterTextSource,
  /\.v-footer-text\s*\{[\s\S]*?color:\s*var\(--ui-color-text-disabled,\s*var\(--color-text-disabled\)\);/u,
  "VFooterText source must preserve the public role override and legacy host fallback",
);
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
  #footer-disabled { color: var(--ui-color-text-disabled, var(--color-text-disabled)); }
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
  #footer-overrides .disabled { color: var(--ui-color-text-disabled, var(--color-text-disabled)); }
  #footer-overrides .accent { color: var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary))); }
  #footer-overrides .pwa-surface { background-color: var(--ui-color-surface, var(--background)); }
  #footer-overrides .pwa-label { color: var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted)); }
`;
// This fixture mirrors the public VFooterText and VFooterBottom templates and
// their compiled role declarations. It is deliberately tied to the source
// assertions above so the browser check cannot pass against an unrelated
// synthetic selector.
const footerComponentStyle = `
  #actual-footer {
    --foreground: #12161f;
    --background: #ffffff;
    --color-text-disabled: #adb5bd;
  }
  #actual-footer .v-footer-text {
    color: var(--ui-color-text-disabled, var(--color-text-disabled));
    background-color: var(--ui-color-surface-inverse, var(--foreground));
  }
  #actual-footer .v-footer-text p,
  #actual-footer .v-footer-text li,
  #actual-footer .v-footer-text ul { color: inherit; }
  #actual-footer .v-footer-bottom {
    background-color: var(--ui-color-surface-inverse, var(--foreground));
  }
  #actual-footer .v-footer-bottom p {
    color: var(--ui-color-text-disabled, var(--color-text-disabled));
  }
  #actual-footer .footer-bottom {
    background-color: var(--ui-color-surface-inverse, var(--foreground));
  }
  #actual-footer .footer-bottom p { color: var(--color-text-disabled); }
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
  <div id="legal" class="semantic-text-probe">Legal resource copy</div>
  <div id="resource" class="semantic-text-probe">Resource copy</div>
  <div id="border" class="border-probe">Border</div>
  <div id="overlay" class="overlay-probe">Overlay</div>
  <div id="header-local" class="local-shadow-probe">Header</div>
  <div id="offer-local" class="local-shadow-probe">Offer</div>
  <div id="footer-surface">Footer surface</div>
  <div id="footer-text">Footer text</div>
  <div id="footer-disclaimer">Footer disclaimer</div>
  <div id="footer-copyright">Footer copyright</div>
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
  <section id="actual-footer">
    <div id="actual-footer-disclosure" class="VFooterText v-footer-text">
      <div class="is--container">
        <p id="actual-footer-disclosure-copy" class="is--small"><strong>Demo website notice:</strong> Disclosure copy.</p>
      </div>
    </div>
    <div id="actual-footer-copyright" class="VFooterBottom v-footer-bottom">
      <p id="actual-footer-copyright-copy" class="is--container is--small v-footer-bottom__container">© 2026 Demo.</p>
    </div>
    <div id="actual-footer-legacy-bottom" class="footer-bottom">
      <p id="actual-footer-legacy-copy">© 2026 Demo.</p>
    </div>
    <div id="actual-footer-ui-override-disclosure" class="VFooterText v-footer-text"
      style="--ui-color-text-disabled: #112233; --color-text-disabled: #445566;">
      <div class="is--container"><p id="actual-footer-ui-override-disclosure-copy">Override disclosure copy.</p></div>
    </div>
    <div id="actual-footer-ui-override-copyright" class="VFooterBottom v-footer-bottom"
      style="--ui-color-text-disabled: #112233; --color-text-disabled: #445566;">
      <p id="actual-footer-ui-override-copyright-copy">Override copyright.</p>
    </div>
  </section>
`;
const probeStyle = `
  body { color: var(--foreground); }
  .raised { box-shadow: var(--ui-shadow-raised, var(--shadow-raised)); }
  .sheet-shadow { box-shadow: var(--shadow-sheet); }
  .badge-shadow { box-shadow: var(--shadow-badge); }
  .shadow-probe { box-shadow: var(--ui-shadow-control, var(--shadow-control)); }
  #semantic { --shadow-control: 0 0 0 0 rgb(1 2 3); }
  #ui { --shadow-control: 0 0 0 0 rgb(1 2 3); --ui-shadow-control: 0 0 0 0 rgb(4 5 6); }
  .text-probe { color: var(--color-text-strong); }
  .semantic-text-probe { color: var(--color-text-strong); }
  .border-probe { border-top: 1px solid var(--color-border-strong); }
  .overlay-probe { background-color: var(--color-overlay-page); }
  .local-shadow-probe {
    box-shadow: var(--ui-shadow-control,
      0 2px 5px 1px color-mix(in srgb, #12161f 3%, transparent),
      0 2px 3px -2px color-mix(in srgb, #12161f 15%, transparent));
  }
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
  await page.setContent(`<style>${tokens}</style><style>${geometry}</style><style>${components}</style><style>${footerProbeStyle}</style><style>${footerComponentStyle}</style><style>${probeStyle}</style>${probes}`);
  const computed = async (id, property) => page.locator(`#${id}`).evaluate((element, name) => getComputedStyle(element).getPropertyValue(name).trim(), property);
  const checks = [
    ["control-shadow", normalizeShadow(await computed("control", "box-shadow")), shadowValues.redControl],
    ["outline-default", await computed("outline", "box-shadow"), "none"],
    ["ghost-default", await computed("ghost", "box-shadow"), "none"],
    ["dialog-shadow", normalizeShadow(await computed("dialog", "box-shadow")), shadowValues.redDialog],
    ["raised-shadow", normalizeShadow(await computed("raised", "box-shadow")), shadowValues.redRaised],
    ["semantic-shadow-override", normalizeShadow(await computed("semantic", "box-shadow")), "0 0 0 0 rgb(1 2 3)"],
    ["ui-shadow-override", normalizeShadow(await computed("ui", "box-shadow")), "0 0 0 0 rgb(4 5 6)"],
    ["absent-primitive-inherits-host-color", await computed("text", "color"), "rgb(255, 0, 0)"],
    ["legal-resource-text-inherits-host-color", await computed("legal", "color"), "rgb(255, 0, 0)"],
    ["resource-text-inherits-host-color", await computed("resource", "color"), "rgb(255, 0, 0)"],
    ["border-fallback-current-color", await computed("border", "border-top-color"), "rgb(255, 0, 0)"],
    ["overlay-fallback-transparent", await computed("overlay", "background-color"), "color(srgb 0 0 0 / 0)"],
    ["header-local-neutral-shadow", normalizeShadow(await computed("header-local", "box-shadow")), "0 2px 5px 1px rgb(18 22 31 / 3%), 0 2px 3px -2px rgb(18 22 31 / 15%)"],
    ["offer-local-neutral-shadow", normalizeShadow(await computed("offer-local", "box-shadow")), "0 2px 5px 1px rgb(18 22 31 / 3%), 0 2px 3px -2px rgb(18 22 31 / 15%)"],
    ["sheet-shadow", normalizeShadow(await computed("sheet", "box-shadow")), "0 25px 50px -12px rgba(0, 0, 0, 0.25)"],
    ["badge-shadow", normalizeShadow(await computed("badge", "box-shadow")), "0 2px 4px 0 rgba(0, 0, 0, 0.15)"],
    ["footer-surface-host-foreground", await computed("footer-surface", "background-color"), "rgb(255, 0, 0)"],
    ["footer-text-host-background", await computed("footer-text", "color"), "rgb(240, 225, 210)"],
    ["footer-disclaimer-host-background", await computed("footer-disclaimer", "color"), "rgb(255, 0, 0)"],
    ["footer-copyright-host-background", await computed("footer-copyright", "color"), "rgb(255, 0, 0)"],
    ["footer-disabled-host-disabled", await computed("footer-disabled", "color"), "rgb(173, 181, 189)"],
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
    ["footer-disclosure-0.2.1-host-token", await computed("actual-footer-disclosure-copy", "color"), "rgb(173, 181, 189)"],
    ["footer-copyright-0.2.1-host-token", await computed("actual-footer-copyright-copy", "color"), "rgb(173, 181, 189)"],
    ["footer-legacy-bottom-0.4.0-host-token", await computed("actual-footer-legacy-copy", "color"), "rgb(173, 181, 189)"],
    ["footer-disclosure-ui-precedence", await computed("actual-footer-ui-override-disclosure-copy", "color"), "rgb(17, 34, 51)"],
    ["footer-copyright-ui-precedence", await computed("actual-footer-ui-override-copyright-copy", "color"), "rgb(17, 34, 51)"],
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
    // The authenticated 0.2.1 archive exposes the neutral dictionary, not the
    // 0.3.0 grey/navy aliases. It must therefore retain the absent-alias
    // behavior instead of selecting a producer palette literal.
    document.documentElement.style.setProperty("--gt-primitive-color-neutral-950", "#0f172a");
    document.documentElement.style.setProperty("--gt-primitive-color-grey-500", "#18181b");
    document.documentElement.style.setProperty("--color-text-disabled", foreground);
  }, "#adb5bd");
  {
    const textActual = await computed("text", "color");
    assert.equal(textActual, "rgb(255, 0, 0)", "authenticated 0.2.1 neutral tokens must not activate 0.3.0 aliases");
    report.checks.push({ name: "tokens-0.2.1-neutral-only", result: "pass", value: textActual });
    const actual = await computed("footer-disabled", "color");
    assert.equal(actual, "rgb(173, 181, 189)", "authenticated 0.2.1 host disabled token must remain the footer fallback");
    report.checks.push({ name: "tokens-0.2.1-footer-compatibility", result: "pass", value: actual });
    for (const [name, id] of [
      ["tokens-0.2.1-disclosure-pixel", "actual-footer-disclosure-copy"],
      ["tokens-0.2.1-copyright-pixel", "actual-footer-copyright-copy"],
    ]) {
      const footerActual = await computed(id, "color");
      assert.equal(footerActual, "rgb(173, 181, 189)", `${name} must retain the host disabled token`);
      report.checks.push({ name, result: "pass", value: footerActual });
    }
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--ui-color-text-disabled", "#112233"));
  for (const [name, id] of [
    ["tokens-0.3.0-disclosure-role", "actual-footer-disclosure-copy"],
    ["tokens-0.3.0-copyright-role", "actual-footer-copyright-copy"],
  ]) {
    const actual = await computed(id, "color");
    assert.equal(actual, "rgb(17, 34, 51)", `${name} must honor the 0.3.0 public role`);
    report.checks.push({ name, result: "pass", value: actual });
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
