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

// 0.2.1 intentionally does not publish these legacy aliases; its neutral
// dictionary is a supported intermediate host, not a reason to invent a new
// palette. The CSS-wide `unset` terminal restores 0.4.0's property behavior.
// 0.3.0 publishes the aliases and therefore wins over the terminal value.
const primitiveFallbacks = new Map([
  ["--gt-primitive-color-grey-800", ["unset"]],
  ["--gt-primitive-color-grey-700", ["unset"]],
  ["--gt-primitive-color-grey-500", ["unset"]],
  ["--gt-primitive-color-grey-400", ["unset"]],
  ["--gt-primitive-color-navy-900", ["unset"]],
  ["--gt-primitive-color-primary-600", ["unset"]],
  ["--gt-primitive-color-secondary-600", ["unset"]],
  ["--gt-primitive-color-secondary-100", ["unset"]],
  ["--gt-primitive-color-scarlet-50", ["unset"]],
  ["--gt-primitive-color-gold-400", ["unset"]],
  ["--gt-primitive-color-gold-50", ["unset"]],
  ["--gt-primitive-color-grape-700", ["unset"]],
  ["--gt-primitive-color-grape-50", ["unset"]],
  ["--gt-primitive-color-iris-tint", ["unset"]],
  ["--gt-primitive-color-slate-200", ["unset"]],
  ["--gt-primitive-color-slate-950", ["unset"]],
  ["--gt-primitive-color-charcoal-500", ["unset", "transparent"]],
  ["--gt-primitive-shadow-sheet", ["unset"]],
  ["--gt-primitive-shadow-badge", ["unset"]],
  ["--gt-primitive-color-azure-tint-200", ["unset"]],
  ["--gt-primitive-color-azure-tint-100", ["unset"]],
]);
const primitiveReads = [...geometry.matchAll(/var\((--gt-primitive-[a-z0-9-]+),\s*([^)]*)\)/gu)]
  .map(([, primitive, fallback]) => ({ primitive, fallback: fallback.trim() }));
assert.ok(primitiveReads.length >= primitiveFallbacks.size, "every reviewed primitive must be referenced");
for (const [primitive, allowedFallbacks] of primitiveFallbacks) {
  const reads = primitiveReads.filter((read) => read.primitive === primitive);
  assert.ok(reads.length > 0, `${primitive} is missing from the static primitive inventory`);
  for (const read of reads) {
    assert.ok(allowedFallbacks.includes(read.fallback), `${primitive} has unreviewed terminal ${read.fallback}`);
  }
}
assert.doesNotMatch(
  geometry,
  /var\(--gt-primitive-[a-z0-9-]+\)/u,
  "primitive reads must always have an explicit reviewed terminal",
);
assert.match(
  geometry,
  /--color-overlay-page:\s*color-mix\(in srgb, var\(--gt-primitive-color-charcoal-500, transparent\) 20%, transparent\)/u,
  "overlay fallback must remain transparent rather than inventing a palette literal",
);

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
  /--shadow-sheet: var\(--gt-primitive-shadow-sheet, unset\)/u,
);
assert.match(
  geometry,
  /--shadow-badge: var\(--gt-primitive-shadow-badge, unset\)/u,
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
const [vFooter, vFooterBottom, vFooterMenu, vFooterText] = footers;
const footerContracts = [
  ["inverse surface follows the host foreground", "var(--ui-color-surface-inverse, var(--foreground))"],
  ["inverse text follows the host background", "var(--ui-color-text-inverse, var(--background))"],
  ["disabled footer text keeps the legacy host token", "var(--ui-color-text-disabled, var(--color-text-disabled))"],
  ["menu text follows the host muted foreground", "var(--muted-foreground)"],
  ["inverse accent follows the host primary role", "var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary)))"],
  ["active inverse accent retains the host primary fallback", "var(--ui-color-accent-inverse, var(--primary))"],
  ["PWA surface follows the host background", "var(--ui-color-surface, var(--background))"],
  ["PWA active label follows the inverse-muted role", "var(--ui-color-surface-inverse-muted, var(--color-surface-inverse-muted))"],
];
for (const [description, contract] of footerContracts) {
  assert.ok(footerStyles.includes(contract), `${description} contract is missing`);
}
assert.match(
  vFooter,
  /\.footer-bottom\s*\{[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--color-text-disabled\);/u,
  "legacy VFooter bottom text must retain the 0.4.0 host token",
);
assert.match(
  vFooterBottom,
  /\.v-footer-bottom[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--ui-color-text-disabled,\s*var\(--color-text-disabled\)\);/u,
  "VFooterBottom must preserve the public role override and legacy host fallback",
);
assert.match(
  vFooterText,
  /\.v-footer-text\s*\{[\s\S]*?color:\s*var\(--ui-color-text-disabled,\s*var\(--color-text-disabled\)\);/u,
  "VFooterText must preserve the public role override and legacy host fallback",
);
assert.doesNotMatch(
  footerStyles,
  /#12161f|#fff|#004fff/u,
  "footer roles must not reintroduce component-local color literals",
);
assert.match(
  await fs.readFile(path.join(packageDirectory, "src/pwa/assets/pwa-login-arrow.svg"), "utf8"),
  /var\(--ui-color-accent, var\(--primary\)\)/u,
  "login chevron must preserve the public accent override and host primary fallback",
);
const pwaHeader = await fs.readFile(path.join(packageDirectory, "src/pwa/VHeaderPWA.vue"), "utf8");
assert.match(
  pwaHeader,
  /&__pwa-login:not\(\[data-slot\]\)[^}]*color:\s*var\(--ui-color-accent, var\(--primary\)\);/u,
  "PWA login text must preserve the public accent override and host primary fallback",
);
assert.doesNotMatch(
  pwaHeader,
  /&__pwa-login:not\(\[data-slot\]\)[^}]*#004fff/u,
  "PWA login text must not introduce a component-local accent literal",
);
console.log("invest-shell-css-contract-pass");
