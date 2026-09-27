import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { compileString } from "sass";
import { resolveCssContractPackageRoots } from "./css-contract-package-roots.mjs";

const canonicalPackageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { packageDirectory, featuresPackageDirectory } = resolveCssContractPackageRoots({ canonicalPackageDirectory });
const workspaceDirectory = path.resolve(packageDirectory, "../..");
const geometry = await fs.readFile(path.join(packageDirectory, "src/styles/geometry.css"), "utf8");
const components = await fs.readFile(path.join(packageDirectory, "src/styles/components.css"), "utf8");
const logoSource = await fs.readFile(path.join(packageDirectory, "src/components/VLogo.vue"), "utf8");
const loaderSource = await fs.readFile(path.join(packageDirectory, "src/components/VLoader.vue"), "utf8");
const headerBar = await fs.readFile(path.join(packageDirectory, "src/components/VHeaderBar/VHeaderBar.vue"), "utf8");
const offersDetailsSide = await fs.readFile(path.join(featuresPackageDirectory, "src/offers/components/OffersDetailsSide.vue"), "utf8");
const oldLocalShadowFallback = /var\(\s*--ui-shadow-control,\s*0 2px 5px 1px color-mix\(in srgb, #12161f 3%, transparent\),\s*0 2px 3px -2px color-mix\(in srgb, #12161f 15%, transparent\)\s*\)/gu;
const logoStyle = logoSource.match(/<style lang="scss">([\s\S]*?)<\/style>/u)?.[1];
const loaderStyle = loaderSource.match(/<style lang="scss">([\s\S]*?)<\/style>/u)?.[1];
assert.ok(logoStyle, "VLogo source must expose its SCSS contract");
assert.ok(loaderStyle, "VLoader source must expose its SCSS contract");
const compiledLogoStyle = compileString(logoStyle).css;
const compiledLoaderStyle = compileString(loaderStyle).css;
assert.match(
  headerBar,
  /&__logo\s*\{[\s\S]*?max-width:\s*211px;/u,
  "desktop header must retain its 211px logo constraint",
);
assert.equal(
  [...headerBar.matchAll(oldLocalShadowFallback)].length + [...offersDetailsSide.matchAll(oldLocalShadowFallback)].length,
  0,
  "header and offer surfaces must not retain the hard-coded neutral shadow fallback",
);
assert.doesNotMatch(headerBar, /#12161f|color-mix\(in srgb, #12161f/u, "header bar must not contain the old local shadow literal");
assert.doesNotMatch(offersDetailsSide, /#12161f|color-mix\(in srgb, #12161f/u, "offer details side must not contain the old local shadow literal");
const semanticLocalShadow = /box-shadow:\s*var\(--ui-shadow-control,\s*var\(--shadow-control\)\)/gu;
assert.equal([...headerBar.matchAll(semanticLocalShadow)].length, 2, "header bar must use the semantic shadow fallback for fixed and mobile states");
assert.equal([...offersDetailsSide.matchAll(semanticLocalShadow)].length, 1, "offer details side must use the semantic shadow fallback");
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
  <div id="sidebar-border" class="sidebar-border-probe">Sidebar border</div>
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
  <div id="desktop-logo" class="v-logo">
    <span class="v-logo__desktop"><span id="desktop-logo-full" class="v-logo__full"></span></span>
    <span id="desktop-logo-mobile" class="v-logo__mobile"></span>
  </div>
  <div id="header-logo" class="v-logo v-header__logo">
    <span class="v-logo__desktop"><span id="header-logo-full" class="v-logo__full"></span></span>
    <span class="v-logo__mobile"></span>
  </div>
  <div id="loader-logo" class="the-loader__logo v-logo">
    <span class="v-logo__desktop"><span class="v-logo__full" id="loader-logo-full"></span></span>
    <span class="v-logo__mobile"></span>
  </div>
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
  .sidebar-border-probe { border-top: 1px solid var(--ui-color-border, var(--color-sidebar-rule)); }
  .overlay-probe { background-color: var(--color-overlay-page); }
  .v-header__logo { max-width: 211px; }
  #desktop-logo-mobile { display: block !important; }
  .local-shadow-probe {
    box-shadow: var(--ui-shadow-control, var(--shadow-control));
  }
`;

async function runInstalledArtifactFixture(browser, report) {
  const { createServer } = await import("vite");
  const { default: vue } = await import("@vitejs/plugin-vue");
  const fixtureDirectory = await fs.mkdtemp(path.join(packageDirectory, ".css-browser-fixture-"));
  const packageRequire = (await import("node:module")).createRequire(import.meta.url);
  const packageEntries = [
    ["@global-torque/ui-primitives", "dialog"],
    ["@global-torque/ui-kit", "form"],
  ];
  const installedPackages = [];
  for (const [packageName, entry] of packageEntries) {
    const resolvedEntry = packageRequire.resolve(`${packageName}/${entry}`);
    const sourceMarker = `${path.sep}src${path.sep}`;
    const sourceIndex = resolvedEntry.indexOf(sourceMarker);
    assert.ok(sourceIndex > 0, `${packageName} must resolve to its installed source tree`);
    const packageRoot = resolvedEntry.slice(0, sourceIndex);
    const realPackageRoot = await fs.realpath(packageRoot);
    const packageManifest = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
    assert.equal(packageManifest.version, packageName === "@global-torque/ui-primitives" ? "0.1.3" : "0.1.4");
    assert.doesNotMatch(realPackageRoot, /(?:vue-ui|torque-packages)[\\/]packages[\\/]/u, `${packageName} must not resolve through a workspace package`);
    installedPackages.push({ name: packageName, version: packageManifest.version, root: realPackageRoot });
  }
  assert.equal(
    JSON.parse(await fs.readFile(path.join(installedPackages[1].root, "package.json"), "utf8")).dependencies["@global-torque/ui-primitives"],
    "0.1.3",
    "installed UI Kit must retain the published primitive dependency",
  );
  report.checks.push({ name: "installed-ui-artifacts", result: "pass", value: installedPackages.map(({ name, version }) => `${name}@${version}`).join(", ") });

  // The published UI Kit 0.1.4 form barrel omits these legacy component
  // exports; these imports are test-only aliases to the resolved installed
  // package files, never app-local implementations.
  const installedKitRoot = installedPackages[1].root;
  const appSource = `<script setup>
import { ref } from 'vue';
import { Dialog, DialogContent, DialogDescription, DialogScrollContent, DialogTitle } from '@global-torque/ui-primitives/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@global-torque/ui-primitives/sheet';
import {
  Select as PrimitiveSelect, SelectContent as PrimitiveSelectContent,
  SelectItem as PrimitiveSelectItem, SelectTrigger as PrimitiveSelectTrigger,
  SelectValue as PrimitiveSelectValue,
} from '@global-torque/ui-primitives/select';
import {
  VSelect, VSelectContent, VSelectItem, VSelectTrigger, VSelectValue,
} from ${JSON.stringify(path.join(installedKitRoot, "src/form/VSelect/index.ts"))};
import {
  VCombobox, VComboboxAnchor, VComboboxContent, VComboboxInput, VComboboxItem, VComboboxTrigger,
} from ${JSON.stringify(path.join(installedKitRoot, "src/form/VCombobox/index.ts"))};

const selectValue = ref('');
const primitiveSelectValue = ref('');
const comboValue = ref('');
const selectOpen = ref(false);
const primitiveSelectOpen = ref(false);
const comboOpen = ref(false);
const dialogOpen = ref(true);
const scrollDialogOpen = ref(false);
const sheetOpen = ref(false);
</script>

<template>
  <div id="fixture-root">
    <button id="show-scroll" type="button" @click="dialogOpen = false; scrollDialogOpen = true">Show scroll dialog</button>
    <button id="show-sheet" type="button" @click="scrollDialogOpen = false; sheetOpen = true">Show sheet</button>
    <output id="select-value">{{ selectValue }}</output>
    <output id="primitive-select-value">{{ primitiveSelectValue }}</output>
    <output id="combo-value">{{ comboValue }}</output>

    <Dialog :open="dialogOpen">
      <DialogContent data-testid="normal-dialog-content" id="fixture-dialog" :show-close-button="false" class="fixture-dialog">
        <DialogTitle>Layer fixture</DialogTitle>
        <DialogDescription>Portal layer verification</DialogDescription>
        <VSelect v-model="selectValue" :open="selectOpen" @update:open="selectOpen = $event">
          <VSelectTrigger id="select-trigger"><VSelectValue placeholder="Choose" /></VSelectTrigger>
          <VSelectContent data-testid="select-content">
            <VSelectItem value="alpha">Alpha</VSelectItem>
            <VSelectItem value="gamma">Gamma</VSelectItem>
          </VSelectContent>
        </VSelect>
        <PrimitiveSelect v-model="primitiveSelectValue" :open="primitiveSelectOpen" @update:open="primitiveSelectOpen = $event">
          <PrimitiveSelectTrigger id="primitive-select-trigger">
            <PrimitiveSelectValue placeholder="Primitive choose" />
          </PrimitiveSelectTrigger>
          <PrimitiveSelectContent data-testid="primitive-select-content">
            <PrimitiveSelectItem class="primitive-select-item" value="primitive-alpha">Primitive Alpha</PrimitiveSelectItem>
            <PrimitiveSelectItem class="primitive-select-item" value="primitive-gamma">Primitive Gamma</PrimitiveSelectItem>
          </PrimitiveSelectContent>
        </PrimitiveSelect>
        <VCombobox v-model="comboValue" :open="comboOpen" @update:open="comboOpen = $event">
          <VComboboxAnchor>
            <VComboboxInput id="combo-input" placeholder="Search" />
            <VComboboxTrigger />
          </VComboboxAnchor>
          <VComboboxContent data-testid="combo-content">
            <VComboboxItem value="beta">Beta</VComboboxItem>
            <VComboboxItem value="delta">Delta</VComboboxItem>
          </VComboboxContent>
        </VCombobox>
      </DialogContent>
    </Dialog>

    <Dialog :open="scrollDialogOpen">
      <DialogScrollContent data-testid="scroll-dialog-content" class="fixture-dialog">
        <DialogTitle>Scroll layer</DialogTitle>
        <DialogDescription>Scroll layer verification</DialogDescription>
      </DialogScrollContent>
    </Dialog>

    <Sheet :open="sheetOpen">
      <SheetContent data-testid="sheet-content" :show-close-button="false"><SheetTitle>Sheet layer</SheetTitle><SheetDescription>Sheet layer verification</SheetDescription></SheetContent>
    </Sheet>
  </div>
</template>

<style>
html, body, #app { margin: 0; width: 100%; min-height: 100%; }
#fixture-header { position: fixed; inset: 0 0 auto; height: 56px; z-index: 100; pointer-events: auto; background: #f8fafc; }
#select-value, #combo-value { position: fixed; left: 16px; top: 120px; }
#select-value { top: 140px; }
#combo-value { top: 160px; }
#primitive-select-value { top: 180px; }
.fixture-dialog { width: 520px; max-width: 520px; }
.v-select-trigger, .v-combobox-anchor { position: relative; z-index: 1; }
</style>
`;
  const entrySource = `import { createApp } from 'vue';
import App from './App.vue';
import './tailwind-utilities.css';
import ${JSON.stringify(path.join(packageDirectory, "src/styles/geometry.css"))};
import ${JSON.stringify(path.join(packageDirectory, "src/styles/components.css"))};
createApp(App).mount('#app');
`;
  let server;
  let page;
  try {
    await fs.writeFile(path.join(fixtureDirectory, "App.vue"), appSource);
    await fs.writeFile(path.join(fixtureDirectory, "main.ts"), entrySource);
    // This is the host's compiled Tailwind utility output for the published
    // primitive class. The shell bridge must override it only for ordinary
    // portaled surfaces; Sheet intentionally remains at this baseline layer.
    await fs.writeFile(
      path.join(fixtureDirectory, "tailwind-utilities.css"),
      "@layer utilities { .fixed { position: fixed; } .inset-0 { inset: 0; } .top-\\[50\\%\\] { top: 50%; } .left-\\[50\\%\\] { left: 50%; } .translate-x-\\[-50\\%\\] { transform: translateX(-50%); } .translate-y-\\[-50\\%\\] { transform: translateY(-50%); } .translate-x-\\[-50\\%\\].translate-y-\\[-50\\%\\] { transform: translate(-50%, -50%); } .w-full { width: 100%; } .z-50 { z-index: 50; } }\n",
    );
    await fs.writeFile(
      path.join(fixtureDirectory, "index.html"),
      '<header id="fixture-header" class="v-header" data-clicks="0" onclick="this.dataset.clicks = String(Number(this.dataset.clicks) + 1)">Fixed header</header><div id="app"></div><script type="module" src="/main.ts"></script>',
    );
    server = await createServer({
      root: fixtureDirectory,
      plugins: [vue()],
      resolve: { dedupe: ["vue"] },
      server: { host: "127.0.0.1", port: 0, strictPort: false, fs: { allow: [packageDirectory, workspaceDirectory, ...installedPackages.map(({ root }) => root)] } },
      optimizeDeps: { exclude: ["@global-torque/ui-primitives", "@global-torque/ui-kit"] },
    });
    await server.listen();
    const localUrl = server.resolvedUrls?.local?.[0];
    assert.ok(localUrl, "fixture Vite server must expose a local URL");
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(localUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='normal-dialog-content']");
    const computedLayer = async (selector) => page.locator(selector).first().evaluate((element) => getComputedStyle(element).zIndex);
    const defaultLayers = {
      header: await computedLayer("#fixture-header"),
      dialogOverlay: await computedLayer("[data-slot='dialog-overlay']"),
      dialogContent: await computedLayer("[data-slot='dialog-content']"),
    };
    assert.deepEqual(defaultLayers, { header: "100", dialogOverlay: "1100", dialogContent: "1100" });
    report.checks.push({ name: "installed-dialog-and-sheet-layers", result: "pass", value: defaultLayers });
    await page.mouse.click(8, 8);
    assert.equal(await page.locator("#fixture-header").getAttribute("data-clicks"), "0", "dialog overlay must block header interaction");
    assert.equal(
      await page.evaluate(() => document.elementFromPoint(8, 8)?.getAttribute("data-slot")),
      "dialog-overlay",
      "dialog overlay must paint above the fixed header",
    );
    report.checks.push({ name: "dialog-overlay-paint-order", result: "pass", value: "dialog-overlay above header" });

    const triggerBox = await page.locator("#select-trigger").boundingBox();
    assert.ok(triggerBox, "select trigger must be measurable inside the dialog");
    const triggerPaint = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      const content = document.querySelector("[data-slot='dialog-content']");
      const overlay = document.querySelector("[data-slot='dialog-overlay']");
      const describe = (node) => node && {
        id: node.id,
        slot: node.getAttribute("data-slot"),
        rect: node.getBoundingClientRect().toJSON(),
        zIndex: getComputedStyle(node).zIndex,
        pointerEvents: getComputedStyle(node).pointerEvents,
      };
      return { id: element?.id, slot: element?.getAttribute("data-slot"), tag: element?.tagName, content: describe(content), overlay: describe(overlay) };
    }, { x: triggerBox.x + triggerBox.width / 2, y: triggerBox.y + triggerBox.height / 2 });
    assert.equal(triggerPaint.id, "select-trigger", `dialog content must paint above its overlay at the Select trigger (${JSON.stringify({ triggerBox, triggerPaint })})`);
    await page.locator("#select-trigger").click();
    await page.waitForSelector("[data-testid='select-content']");
    assert.equal(await computedLayer("[data-testid='select-content']"), "1100");
    await page.locator(".v-select-item").filter({ hasText: "Alpha" }).click();
    await page.waitForFunction(() => document.querySelector("#select-value")?.textContent?.trim() === "alpha");
    report.checks.push({ name: "installed-select-pointer-selection", result: "pass", value: "alpha" });

    await page.locator("#primitive-select-trigger").click();
    await page.waitForSelector("[data-testid='primitive-select-content']");
    assert.equal(await computedLayer("[data-testid='primitive-select-content']"), "1100");
    const primitiveSelectBox = await page.locator("[data-testid='primitive-select-content']").boundingBox();
    assert.ok(primitiveSelectBox, "primitive Select popup must be measurable");
    assert.equal(
      await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-testid='primitive-select-content']")?.getAttribute("data-testid"), { x: primitiveSelectBox.x + primitiveSelectBox.width / 2, y: primitiveSelectBox.y + primitiveSelectBox.height / 2 }),
      "primitive-select-content",
      "primitive Select popup must be hit-testable above the dialog layer",
    );
    await page.locator(".primitive-select-item").filter({ hasText: "Primitive Alpha" }).click();
    await page.waitForFunction(() => document.querySelector("#primitive-select-value")?.textContent?.trim() === "primitive-alpha");
    report.checks.push({ name: "installed-primitive-select-pointer-selection", result: "pass", value: "primitive-alpha" });

    await page.locator(".v-combobox-trigger").click();
    await page.waitForSelector("[data-testid='combo-content']");
    assert.equal(await computedLayer("[data-testid='combo-content']"), "1100");
    const comboBox = await page.locator("[data-testid='combo-content']").boundingBox();
    assert.ok(comboBox, "Combobox popup must be measurable");
    assert.equal(
      await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-testid='combo-content']")?.getAttribute("data-testid"), { x: comboBox.x + comboBox.width / 2, y: comboBox.y + comboBox.height / 2 }),
      "combo-content",
      "Combobox popup must be hit-testable above the dialog layer",
    );
    await page.locator(".v-combobox-item").filter({ hasText: "Beta" }).click();
    await page.waitForFunction(() => document.querySelector("#combo-value")?.textContent?.trim() === "beta");
    report.checks.push({ name: "installed-combobox-pointer-selection", result: "pass", value: "beta" });

    await page.evaluate(() => {
      document.documentElement.style.removeProperty("--ui-dialog-z-index");
      document.documentElement.style.removeProperty("--ui-select-popup-z-index");
      document.querySelector("#show-scroll")?.click();
    });
    await page.waitForSelector("[data-testid='scroll-dialog-content']");
    const scrollContent = page.locator("[data-testid='scroll-dialog-content']");
    const scrollOverlay = scrollContent.locator("xpath=..");
    const scrollLayers = {
      header: await computedLayer("#fixture-header"),
      overlay: await scrollOverlay.evaluate((element) => getComputedStyle(element).zIndex),
      content: await computedLayer("[data-testid='scroll-dialog-content']"),
    };
    assert.deepEqual(scrollLayers, { header: "100", overlay: "1100", content: "1100" });
    assert.equal(
      await page.evaluate(() => document.elementFromPoint(8, 8) === document.querySelector("[data-testid='scroll-dialog-content']")?.parentElement),
      true,
      "legacy scroll overlay must paint above the fixed header",
    );
    await page.mouse.click(8, 8);
    assert.equal(await page.locator("#fixture-header").getAttribute("data-clicks"), "0", "legacy scroll overlay must block header interaction");
    report.checks.push({ name: "legacy-scroll-dialog-layer-and-hit-test", result: "pass", value: scrollLayers });

    await page.evaluate(() => {
      document.documentElement.style.setProperty("--ui-dialog-z-index", "2400");
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-testid='scroll-dialog-content']")).zIndex === "2400");
    const overriddenScrollLayers = {
      overlay: await scrollOverlay.evaluate((element) => getComputedStyle(element).zIndex),
      content: await computedLayer("[data-testid='scroll-dialog-content']"),
    };
    assert.deepEqual(overriddenScrollLayers, { overlay: "2400", content: "2400" });
    assert.equal(
      await page.evaluate(() => document.elementFromPoint(8, 8) === document.querySelector("[data-testid='scroll-dialog-content']")?.parentElement),
      true,
      "host-overridden scroll overlay must remain above the fixed header",
    );
    await page.mouse.click(8, 8);
    assert.equal(await page.locator("#fixture-header").getAttribute("data-clicks"), "0", "host-overridden scroll overlay must block header interaction");
    report.checks.push({ name: "legacy-scroll-dialog-host-override", result: "pass", value: overriddenScrollLayers });

    await page.evaluate(() => document.querySelector("#show-sheet")?.click());
    await page.waitForSelector("[data-testid='sheet-content']");
    const sheetContent = page.locator("[data-testid='sheet-content']");
    const sheetOverlay = sheetContent.locator("xpath=preceding-sibling::*[1]");
    const sheetLayers = {
      header: await computedLayer("#fixture-header"),
      sheetOverlay: await sheetOverlay.evaluate((element) => getComputedStyle(element).zIndex),
      sheetContent: await computedLayer("[data-testid='sheet-content']"),
    };
    assert.deepEqual(sheetLayers, { header: "100", sheetOverlay: "50", sheetContent: "50" });
    const sheetPaint = await page.evaluate(() => {
      const element = document.elementFromPoint(8, 8);
      const header = document.querySelector("#fixture-header");
      const overlay = document.querySelector("[data-testid='sheet-content']")?.previousElementSibling;
      const describe = (node) => node && {
        id: node.id,
        testId: node.getAttribute("data-testid"),
        zIndex: getComputedStyle(node).zIndex,
        pointerEvents: getComputedStyle(node).pointerEvents,
        inert: node.inert,
      };
      return { element: describe(element), header: describe(header), overlay: describe(overlay) };
    });
    assert.equal(sheetPaint.element?.id, "fixture-header", `Sheet overlay must paint below the fixed header (${JSON.stringify(sheetPaint)})`);
    await page.mouse.click(8, 8);
    assert.equal(await page.locator("#fixture-header").getAttribute("data-clicks"), "1", "Sheet layer below header must preserve header interaction");
    report.checks.push({ name: "sheet-layer-and-paint-order", result: "pass", value: sheetLayers });
  } finally {
    await page?.close();
    await server?.close();
    await fs.rm(fixtureDirectory, { recursive: true, force: true });
  }
}

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
  await page.setContent(`<style>${tokens}</style><style>${geometry}</style><style>${components}</style><style>${compiledLogoStyle}</style><style>${compiledLoaderStyle}</style><style>${footerProbeStyle}</style><style>${footerComponentStyle}</style><style>${probeStyle}</style>${probes}`);
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
    ["sidebar-border-fallback-neutral", await computed("sidebar-border", "border-top-color"), "rgb(226, 232, 240)"],
    ["logo-mobile-mark", `${(await page.locator("#desktop-logo-mobile").boundingBox())?.width}x${(await page.locator("#desktop-logo-mobile").boundingBox())?.height}`, "36x36"],
    ["overlay-fallback-transparent", await computed("overlay", "background-color"), "color(srgb 0 0 0 / 0)"],
    ["header-local-semantic-shadow", normalizeShadow(await computed("header-local", "box-shadow")), shadowValues.redControl],
    ["offer-local-semantic-shadow", normalizeShadow(await computed("offer-local", "box-shadow")), shadowValues.redControl],
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
  for (const [name, id, expected] of [
    ["logo-desktop-intrinsic-ratio", "desktop-logo-full", { width: 214.2, height: 36 }],
    ["logo-header-max-width", "header-logo-full", { width: 211, height: 36 }],
    ["logo-loader-proportional-ratio", "loader-logo-full", { width: 357, height: 60 }],
  ]) {
    const box = await page.locator(`#${id}`).boundingBox();
    assert.ok(box, `${name} element must be measurable`);
    assert.ok(Math.abs(box.width - expected.width) < 0.1, `${name} width mismatch: ${box.width}`);
    assert.ok(Math.abs(box.height - expected.height) < 0.1, `${name} height mismatch: ${box.height}`);
    report.checks.push({ name, result: "pass", value: `${box.width}x${box.height}` });
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--gt-primitive-color-slate-200", "#123456"));
  {
    const actual = await computed("sidebar-border", "border-top-color");
    assert.equal(actual, "rgb(18, 52, 86)", "authenticated slate primitive must override the neutral sidebar fallback");
    report.checks.push({ name: "sidebar-border-token-override", result: "pass", value: actual });
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--gt-primitive-color-grey-800", "#010203"));
  {
    const actual = await computed("text", "color");
    assert.equal(actual, "rgb(1, 2, 3)", "authenticated 0.3.0 primitive must win over its literal fallback");
    report.checks.push({ name: "tokens-0.3.0-primitive", result: "pass", value: actual });
  }
  await page.evaluate((foreground) => {
    document.documentElement.style.removeProperty("--gt-primitive-color-grey-800");
    document.documentElement.style.removeProperty("--gt-primitive-color-slate-200");
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
    ["header-local-shadow-host-foreground", "header-local", shadowValues.greenControl],
    ["offer-local-shadow-host-foreground", "offer-local", shadowValues.greenControl],
  ]) {
    const actual = normalizeShadow(await computed(id, "box-shadow"));
    assert.equal(actual, expected, `${name} computed value mismatch`);
    report.checks.push({ name, result: "pass", value: actual });
  }
  await page.evaluate(() => {
    for (const id of ["header-local", "offer-local"]) {
      document.getElementById(id)?.style.setProperty("--ui-shadow-control", "0 0 0 0 rgb(4 5 6)");
    }
  });
  for (const [name, id] of [
    ["header-local-ui-shadow-override", "header-local"],
    ["offer-local-ui-shadow-override", "offer-local"],
  ]) {
    const actual = normalizeShadow(await computed(id, "box-shadow"));
    assert.equal(actual, "0 0 0 0 rgb(4 5 6)", `${name} must honor the public UI shadow override`);
    report.checks.push({ name, result: "pass", value: actual });
  }
  await runInstalledArtifactFixture(browser, report);
  report.result = "pass";
} finally {
  await browser.close();
}

const reportPath = process.env.CSS_BROWSER_REPORT;
if (reportPath) await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
const reportDigest = crypto.createHash("sha256").update(JSON.stringify(report)).digest("hex");
console.log(`invest-shell-css-browser-pass ${reportDigest}`);
