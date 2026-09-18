# Canonical JSON Grammar v1

The redemption command, grant scope, and checkpoint evidence digests use one
small canonical JSON grammar across TypeScript, Go, and Python. This grammar is
an application protocol and is explicitly **not RFC 8785/JCS**.

The accepted values are `null`, booleans, finite JSON numbers, strings, arrays,
and plain objects with string keys. Arrays preserve order. Object keys are
sorted by Unicode scalar value before encoding. Strings use the runtime's JSON
string escaping with UTF-8 output, objects and arrays contain no insignificant
whitespace, and negative zero is encoded as `0`. Cycles and unsupported values
(`undefined`, `bigint`, symbols, functions, bytes, dates, sets, and custom
objects) are rejected. Protocol quantities, identifiers, block numbers, and
amounts remain decimal strings; numbers are not a substitute for those fields.

Every owner must hash the UTF-8 bytes of the resulting document with SHA-256
and render the digest as lowercase hexadecimal. The normative fixture is
duplicated in the framework, EVM API, fund-manager API, and i-models trees so a
cross-language change cannot silently change an idempotency key.
