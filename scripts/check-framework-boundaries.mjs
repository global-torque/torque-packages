import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const packageRoot = path.join(root, 'packages');
const sourceFiles = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|vue|js|mjs)$/u.test(entry.name)) sourceFiles.push(file);
  }
};
walk(packageRoot);

const failures = [];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (/@global-torque\/ui-kit\/form-validation\//u.test(source)) failures.push(`${relative}: UI validation must use the public barrel`);
  if (/@global-torque\/ui-kit\/url-sync\//u.test(source)) failures.push(`${relative}: URL sync must use the public barrel`);
  if (/https?:\/\/[^'"\s]*(?:webdevelop-pro|global-torque)[^'"\s]*/iu.test(source) && /invest-widgets\/src\/socials\/socials\.ts$/u.test(file)) {
    failures.push(`${relative}: framework social metadata must not contain company destinations`);
  }
  if (/from\s+['"](?:\.\/)?(?:apps|packages\/ui-kit|packages\/invest-sdk)\//u.test(source)) failures.push(`${relative}: source imports an unavailable sibling implementation`);
}

const socials = fs.readFileSync(path.join(packageRoot, 'invest-widgets/src/socials/socials.ts'), 'utf8');
const catalog = socials.split('export const socials', 2)[1]?.split('export const resolveSocialList', 1)[0] ?? '';
if (/^\s*href\s*:/mu.test(catalog)) failures.push('invest-widgets/src/socials/socials.ts: social catalog contains host destinations');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`framework-boundary-pass ${sourceFiles.length} source-files`);
}
