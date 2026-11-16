#!/bin/bash
# Builds Typo.js from ts/typo.ts:
#   typo/typo.js     classic browser script (global `Typo`) that also works with require() in Node.js
#   typo/typo.mjs    ES module
#   typo/typo.d.ts   TypeScript declarations for typo.js (`export = Typo`)
#   typo/typo.d.mts  TypeScript declarations for typo.mjs (`export default Typo`)
set -euo pipefail
cd "$(dirname "$0")"

BIN=./node_modules/.bin
ENTRY=ts/typo.ts
BANNER="/* Typo.js — a Hunspell-style spellchecker. BSD-3-Clause. https://github.com/cfinke/Typo.js */"

# tsc emits declarations for an ES module. typo.mjs uses them as they are; typo.js sets
# module.exports to the class, so its declarations export the class with `export =` and
# expose the other types through a namespace merged with it.
TYPES_DIR=$(mktemp -d)
trap 'rm -rf "$TYPES_DIR"' EXIT

# tsconfig.json only type-checks; the declarations are emitted into a scratch directory.
"$BIN/tsc" -p tsconfig.json --noEmit false --declaration --emitDeclarationOnly --outDir "$TYPES_DIR"

cp "$TYPES_DIR/typo.d.ts" typo/typo.d.mts

node - "$TYPES_DIR/typo.d.ts" typo/typo.d.ts <<'EOF'
const fs = require("fs");
const [source, destination] = process.argv.slice(2);
const names = [];

let text = fs.readFileSync(source, "utf8").replace(/^export (?:declare )?(interface|type|class) (\w+)/gm, (match, kind, name) => {
	names.push(name);

	return (kind === "class" ? "declare class " : kind + " ") + name;
});

if (!/^export default Typo;\n/m.test(text) || /^export /m.test(text.replace(/^export default Typo;\n/m, ""))) {
	throw new Error("build.sh: unexpected exports in " + source);
}

text = text.replace(/^export default Typo;\n/m,
	"declare namespace Typo {\n\texport { " + names.join(", ") + ", Typo as default };\n}\nexport = Typo;\n");

fs.writeFileSync(destination, text);
EOF

"$BIN/esbuild" "$ENTRY" --bundle --format=iife --global-name=Typo --target=es2020 --outfile=typo/typo.js \
  --banner:js="$BANNER" --log-override:empty-import-meta=silent \
  --footer:js="Typo = Typo.default; if (typeof module !== 'undefined') { module.exports = Typo; module.exports.Typo = Typo; module.exports.default = Typo; }"

"$BIN/esbuild" "$ENTRY" --bundle --format=esm --target=es2020 --outfile=typo/typo.mjs \
  --banner:js="$BANNER" --log-override:empty-import-meta=silent
