import fs from "node:fs";
import path from "node:path";

const SHELL_PACKAGE_NAME = "@global-torque/invest-shell";
const FEATURES_PACKAGE_NAME = "@global-torque/invest-features";
const WORKSPACE_PACKAGE_NAME = "@global-torque/torque-packages-workspace";

function readManifest(directory) {
  const manifestPath = path.join(directory, "package.json");
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`CSS contract root is missing a readable package manifest: ${manifestPath}`, { cause: error });
  }
}

function assertPackageManifest(directory, expectedName) {
  const manifest = readManifest(directory);
  if (manifest.name !== expectedName) {
    throw new Error(`CSS contract root ${directory} must contain ${expectedName}, found ${manifest.name ?? "unknown"}`);
  }
  if (typeof manifest.version !== "string" || !manifest.version) {
    throw new Error(`CSS contract root ${directory} must declare a package version`);
  }
  return manifest;
}

function assertSameCohort(shellManifest, featuresManifest) {
  if (shellManifest.version !== featuresManifest.version) {
    throw new Error(
      `CSS contract roots must use the same package cohort: ${shellManifest.version} !== ${featuresManifest.version}`,
    );
  }
}

function assertTorqueWorkspaceRoot(workspaceRoot, canonicalPackageDirectory, featuresPackageDirectory) {
  const workspaceManifest = readManifest(workspaceRoot);
  if (workspaceManifest.name !== WORKSPACE_PACKAGE_NAME || workspaceManifest.private !== true) {
    throw new Error(`CSS contract source fallback requires the Torque workspace root: ${workspaceRoot}`);
  }
  const expectedShell = path.resolve(workspaceRoot, "packages/invest-shell");
  const expectedFeatures = path.resolve(workspaceRoot, "packages/invest-features");
  if (path.resolve(canonicalPackageDirectory) !== expectedShell || path.resolve(featuresPackageDirectory) !== expectedFeatures) {
    throw new Error("CSS contract source fallback must resolve the canonical Torque workspace packages");
  }
}

export function resolveCssContractPackageRoots({
  environment = process.env,
  canonicalPackageDirectory,
  workspaceRoot = canonicalPackageDirectory ? path.resolve(canonicalPackageDirectory, "../..") : undefined,
} = {}) {
  if (!canonicalPackageDirectory) throw new Error("CSS contract resolution requires a canonical package directory");
  const packageDirectoryOverride = environment.CSS_CONTRACT_PACKAGE_DIR;
  const featuresPackageDirectoryOverride = environment.CSS_CONTRACT_FEATURES_PACKAGE_DIR;
  const hasPackageDirectoryOverride = packageDirectoryOverride !== undefined;
  const hasFeaturesPackageDirectoryOverride = featuresPackageDirectoryOverride !== undefined;
  if (hasPackageDirectoryOverride !== hasFeaturesPackageDirectoryOverride) {
    throw new Error(
      "CSS_CONTRACT_PACKAGE_DIR and CSS_CONTRACT_FEATURES_PACKAGE_DIR must be provided together with non-empty values",
    );
  }
  if (hasPackageDirectoryOverride && (!packageDirectoryOverride.trim() || !featuresPackageDirectoryOverride.trim())) {
    throw new Error(
      "CSS_CONTRACT_PACKAGE_DIR and CSS_CONTRACT_FEATURES_PACKAGE_DIR must be provided together with non-empty values",
    );
  }

  const usingSourceFallback = !hasPackageDirectoryOverride;
  const packageDirectory = path.resolve(packageDirectoryOverride ?? canonicalPackageDirectory);
  const featuresPackageDirectory = path.resolve(
    featuresPackageDirectoryOverride ?? path.resolve(canonicalPackageDirectory, "../invest-features"),
  );
  if (usingSourceFallback) assertTorqueWorkspaceRoot(workspaceRoot, packageDirectory, featuresPackageDirectory);

  const shellManifest = assertPackageManifest(packageDirectory, SHELL_PACKAGE_NAME);
  const featuresManifest = assertPackageManifest(featuresPackageDirectory, FEATURES_PACKAGE_NAME);
  assertSameCohort(shellManifest, featuresManifest);
  return {
    packageDirectory,
    featuresPackageDirectory,
    version: shellManifest.version,
  };
}
