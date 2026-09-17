# Local consumer framework links

The seven `@global-torque` framework packages can be exercised from this
checkout by a consumer-owned launcher. The launcher calls
`scripts/consumer-links.mjs` and defaults to a temporary `link:` override in
the consumer's `pnpm-workspace.yaml`.

```sh
pnpm framework:link --framework-root /absolute/path/to/torque-packages
pnpm framework:status
pnpm framework:unlink
```

The link transaction requires Node `^24.21.0` and pnpm `12.4.2`. Bootstrap
the executable with Corepack (`corepack enable` and
`corepack prepare pnpm@12.4.2 --activate`); consumer-owned launchers must use
that same version. It installs and builds the
canonical workspace first, snapshots the consumer workspace and protected
metadata, writes a seven-entry temporary override, and runs
`pnpm install --no-lockfile --ignore-scripts`. The workspace file is restored
only when its bytes still match the exact generated overlay. The consumer
`package.json`, committed `pnpm-lock.yaml`, and app manifests are never
rewritten or restored by the tool.

Before the temporary override is written, the tool copies the built-in-only
`framework-links-recovery.mjs` to the ignored consumer directory
`.torque-framework-links/recovery.mjs` and records its hash in
`.torque-framework-links/journal.json`. If the canonical checkout is
unavailable, the retained helper supports `status`, `recover`, and `unlink`.
Recovery accepts only the recorded baseline or overlay workspace bytes. It uses
`pnpm install --force --frozen-lockfile --ignore-scripts` to rebuild the
consumer's disposable registry graph, avoiding pnpm hoist reconciliation of
duplicate aliases while retaining frozen lockfile validation. A concurrent
edit, protected metadata change, mixed framework cohort, interrupted install,
or failed registry restore leaves the journal and records the observed bytes
for a later retry.

Local links are development evidence only. Remove them and run a normal
`pnpm install --frozen-lockfile --ignore-scripts` before release, CI, or
deployment checks. Local mode resolves every framework package to the
canonical source tree, keeps Vue, Pinia, and Vue Router deduped, inlines the
framework's Vue SSR closure, and uses an owner-specific Vite cache directory.
