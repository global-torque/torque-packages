import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const geometryPath = path.join(packageDirectory, "src/styles/geometry.css");
const componentsPath = path.join(packageDirectory, "src/styles/components.css");
const headerBarPath = path.join(packageDirectory, "src/components/VHeaderBar/VHeaderBar.vue");
const offersDetailsSidePath = path.resolve(packageDirectory, "../invest-features/src/offers/components/OffersDetailsSide.vue");
const footerPaths = [
  "src/components/VFooter/VFooter.vue",
  "src/components/VFooter/VFooterBottom.vue",
  "src/components/VFooter/VFooterMenu.vue",
  "src/components/VFooter/VFooterText.vue",
  "src/pwa/PWAFooterMenu.vue",
].map((relativePath) => path.join(packageDirectory, relativePath));
const geometry = await fs.readFile(geometryPath, "utf8");
const components = await fs.readFile(componentsPath, "utf8");
const headerBar = await fs.readFile(headerBarPath, "utf8");
const offersDetailsSide = await fs.readFile(offersDetailsSidePath, "utf8");
const footers = await Promise.all(footerPaths.map((footerPath) => fs.readFile(footerPath, "utf8")));

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
for (const [role, percentage] of [["control", "3%"], ["dialog", "5%"], ["raised", "5%"]]) {
  assert.match(
    geometry,
    new RegExp(`--shadow-${role}:[\\s\\S]*color-mix\\(in srgb, var\\(--foreground\\) ${percentage}`, "u"),
    `${role} shadow must derive from the host foreground`,
  );
}
assert.match(
  geometry,
  /--shadow-raised:[\s\S]*color-mix\(in srgb, var\(--foreground\) 10%/u,
  "raised shadow must retain its second foreground-derived layer",
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
assert.match(
  components,
  /\[data-slot='button'\]\[data-variant='outline'\][\s\S]*box-shadow: var\(--ui-shadow-control, none\)/u,
  "outline buttons default to no shadow while retaining the public override",
);
assert.match(
  components,
  /\[data-slot='button'\]\[data-variant='ghost'\]:not\(\[data-size\x5e='icon'\]\)[\s\S]*box-shadow: var\(--ui-shadow-control, none\)/u,
  "non-icon ghost buttons default to no shadow while retaining the public override",
);
assert.match(
  components,
  /\[data-slot='button'\]\[data-variant='default'\][\s\S]*box-shadow: var\(--ui-shadow-control, var\(--shadow-control\)\)/u,
  "filled controls retain the foreground-derived shadow",
);
const fixedLocalShadow = /box-shadow:\s*var\(\s*--ui-shadow-control,\s*0 2px 5px 1px color-mix\(in srgb, #12161f 3%, transparent\),\s*0 2px 3px -2px color-mix\(in srgb, #12161f 15%, transparent\)\s*\)/u;
assert.match(headerBar, fixedLocalShadow, "header bar must retain its neutral-950 local shadow fallback");
assert.match(offersDetailsSide, fixedLocalShadow, "offer details side must retain its neutral-950 local shadow fallback");
const footerStyles = footers.join("\n");
const footerContracts = [
  ["inverse surface follows the host foreground", "var(--ui-color-surface-inverse, var(--foreground))"],
  ["inverse text follows the host background", "var(--ui-color-text-inverse, var(--background))"],
  ["disabled footer text keeps the legacy inverse fallback", "var(--ui-color-text-disabled, var(--foreground))"],
  ["menu text follows the host muted foreground", "var(--muted-foreground)"],
  ["inverse accent follows the host primary role", "var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary)))"],
  ["active inverse accent retains the host primary fallback", "var(--ui-color-accent-inverse, var(--primary))"],
  ["PWA surface follows the host background", "var(--ui-color-surface, var(--background))"],
  ["PWA active label follows the inverse-muted role", "var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted))"],
];
for (const [description, contract] of footerContracts) {
  assert.ok(footerStyles.includes(contract), `${description} contract is missing`);
}
assert.doesNotMatch(
  footerStyles,
  /#12161f|#fff|#004fff/u,
  "footer roles must not reintroduce component-local color literals",
);
assert.match(
  await fs.readFile(path.join(packageDirectory, "src/pwa/assets/pwa-login-arrow.svg"), "utf8"),
  /var\(--ui-color-accent, #004fff\)/u,
  "login chevron must use the terminal accent fallback",
);
console.log("invest-shell-css-contract-pass");
