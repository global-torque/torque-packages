import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.argv[2] ?? 'pnpm-workspace.yaml');
const archiveArgument = process.argv[3];
if (!archiveArgument) throw new Error('UI Kit overlay archive path is required');
const archive = path.resolve(archiveArgument);
if (!fs.existsSync(archive)) throw new Error(`UI Kit overlay archive is missing: ${archive}`);
const text = fs.readFileSync(workspace, 'utf8');
if (/^\s*['"]?@global-torque\/ui-kit['"]?:/mu.test(text)) throw new Error('UI Kit overlay override already exists');
const marker = 'overrides:\n';
if (!text.includes(marker)) throw new Error('Cannot locate overrides in workspace configuration');
const fileReference = `file:${archive.replaceAll('\\', '/')}`;
const updated = text.replace(marker, `${marker}  '@global-torque/ui-kit': '${fileReference}'\n`);
fs.writeFileSync(workspace, updated);
console.log(`ui-kit-overlay-prepared ${fileReference}`);
