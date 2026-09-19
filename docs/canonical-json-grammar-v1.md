# Canonical JSON Grammar v1

The redemption command, grant scope, and checkpoint evidence digests use one
small canonical JSON grammar across TypeScript, Go, and Python. This grammar is
an application protocol and is explicitly **not RFC 8785/JCS**.

The accepted values are `null`, booleans, safe integer numbers, strings, dense
arrays, and plain objects with string keys. Arrays preserve order. Object keys
are sorted by their UTF-8 bytes before encoding. Strings use the runtime's JSON
string escaping with UTF-8 output, and objects and arrays contain no
insignificant whitespace. Programmatic negative zero is normalized to `0`, but
the raw-input validator rejects a negative-zero token. Cycles, sparse arrays,
accessors, symbol properties, lone surrogates, and unsupported values
(`undefined`, `bigint`, functions, bytes, dates, sets, and custom objects) are
rejected. Protocol quantities, identifiers, block numbers, and amounts remain
decimal strings; numbers are not a substitute for those fields.

When a digest starts from raw JSON, `canonicalJsonFromRaw` validates the token
stream before parsing it. It rejects duplicate object keys, fractions,
exponents, unsafe integers, negative zero, malformed arrays/objects, and lone
surrogate escapes. The invalid-token cases are retained in
`src/__fixtures__/stablecoin_redemption_digest_fixtures.json` so each owner can
exercise the same boundary conditions.

Validation failures throw the public `CanonicalJsonError` class, which extends
`TypeError` for ordinary exception compatibility. Consumers must classify a
failure with its stable `code`, not its diagnostic message. The shared codes
are `duplicate_key`, `negative_zero`, `invalid_number`, `unsafe_integer`,
`invalid_surrogate`, `unsupported_value`, `cycle`, `sparse_array`,
`accessor_property`, `symbol_property`, `array_property`, `non_plain_object`,
and `invalid_raw_json`.

Every owner must hash the UTF-8 bytes of the resulting document with SHA-256
and render the digest as lowercase hexadecimal. The normative fixture is
duplicated in the framework, EVM API, fund-manager API, and i-models trees so a
cross-language change cannot silently change an idempotency key.
