Typo.js is a JavaScript/TypeScript spellchecker that uses Hunspell-style dictionaries.

Usage
=====

To use Typo in a Chrome extension, include the typo.js file in one of your extension's pages (a popup, options page or side panel, for example), and then initialize the dictionary like so:

```javascript
var dictionary = new Typo("en_US");
```

By default, the dictionary files are loaded from the `typo/dictionaries` directory in the root of your extension.

An extension's service worker can only load files asynchronously, so load the dictionary there like this:

```javascript
importScripts("typo/typo.js");

var dictionary;

Typo.load("en_US", { dictionaryPath: chrome.runtime.getURL("typo/dictionaries") }).then(function (loaded) {
	dictionary = loaded;
});
```

To use Typo in a standard web application you need to pass a settings object that provides a path to the folder containing the desired dictionary.

```javascript
var dictionary = new Typo("en_US", false, false, { dictionaryPath: "typo/dictionaries" });
```

If using in node.js, load it like so:

```javascript
var Typo = require("typo-js");
var dictionary = new Typo("en_US");
```

or, as an ES module:

```javascript
import Typo from "typo-js";
var dictionary = await Typo.load("en_US");
```

In node.js, Typo finds the dictionaries that ship with the package on its own. If you import the ES module in a browser (for example, through a bundler), pass the URL that the dictionaries are served from:

```javascript
var dictionary = await Typo.load("en_US", { dictionaryPath: "/node_modules/typo-js/dictionaries" });
```

Your path to `node_modules` may vary. `typo.js` has no dependencies; the `fs` module is only used in node.js and only when Typo loads the dictionary files itself.

If you read the dictionary files yourself, pass their contents as strings:

```javascript
var dictionary = new Typo("de_DE", affData, wordsData);
```

When Typo.js loads the dictionary files itself, it honors the charset declared on the `SET` line of the `.aff` file (e.g. `SET ISO8859-1`). If you read the files yourself and pass their contents to the constructor, decode them with that charset; the `_readFile` helper accepts it as its second argument:

```javascript
var affData = dictionary._readFile("path/to/de_DE.aff", "ISO8859-1");
```

To load a dictionary without blocking, use `asyncLoad`:

```javascript
var dictionary = new Typo("en_US", null, null, {
	asyncLoad: true,
	loadedCallback: function (dict) { /* ready */ },
	errorCallback: function (error) { /* the dictionary could not be loaded */ }
});
```

or `await Typo.load("en_US")`. Parsing is time-sliced through `requestIdleCallback` where available, so a page stays responsive while a large dictionary loads.

To check if a word is spelled correctly, do this:

```javascript
var is_spelled_correctly = dictionary.check("mispelled");
```

To get suggested corrections for a misspelled word, do this:

```javascript
var array_of_suggestions = dictionary.suggest("speling");

// array_of_suggestions == ["spelling", "spieling", "spewing", "peeling", "selling"]
```

API
---

| Member | Description |
| --- | --- |
| `new Typo(locale?, affData?, wordsData?, settings?)` | Creates a checker. With no arguments it is empty and `loaded` is false. |
| `Typo.load(locale, settings?)` | Promise-returning alternative to `asyncLoad`. |
| `check(word)` | Whether a word is spelled correctly. Trims whitespace, applies the ICONV table and accepts capitalization variants (e.g. "Spelling" or "SPELLING" for "spelling"). |
| `checkExact(word)` | Whether the word, exactly as given, is a stem, an affixed form or a compound. |
| `suggest(word, limit = 5)` | Corrections for a misspelled word, best first. Results are cached per word. |
| `hasFlag(word, directive)` | Whether a stem carries the flag named by an `.aff` directive, e.g. `hasFlag("fuck", "NOSUGGEST")`. |
| `loaded`, `dictionary` | Load state and locale code. |
| `rules`, `dictionaryTable`, `compoundRules`, `replacementTable`, `flags`, `memoized` | The parsed dictionary data. `dictionaryTable` maps each stem to an array of its flag strings (one per `.dic` line), or to `null` for a stem listed without flags. |

`settings` accepts `dictionaryPath`, `flags`, `asyncLoad`, `loadedCallback` and `errorCallback`.

Typo.js has full support for the following Hunspell affix flags:

* `PFX`
* `SFX` (including continuation classes, two-level suffixes and prefix/suffix cross products)
* `REP`
* `FLAG` (single-character, `long`, `num` and `UTF-8`)
* `AF`
* `COMPOUNDMIN`
* `COMPOUNDRULE`
* `ONLYINCOMPOUND`
* `KEEPCASE`
* `NOSUGGEST`
* `NEEDAFFIX`
* `FORBIDDENWORD`
* `ICONV`
* `OCONV`
* `TRY` and `WORDCHARS` (used when generating suggestions)

It also supports the Typo-specific flag `PRIORITYSUGGEST`. This allows you to specify that certain words should be given priority in the suggestions list when correcting a misspelled word. If you add the following to your `.aff` file (ideally on the line after NOSUGGEST):

```
PRIORITYSUGGEST @
```

and then add the `@` flag to your new words in your `.dic` file, like

```
skibidi/@
rizz/@
```

then those words will be prioritized above other suggestions if they already appear in the suggestions list.

How it works
------------

The `.dic` file is stored as a map from stem to flag strings; affixed forms are never generated up front, so memory use stays proportional to the size of the dictionary file. To check a word, Typo walks a trie of suffixes from the end of the word (and a trie of prefixes from the start), builds the candidate stem for each matching affix and looks it up, following continuation classes for a second suffix. Compound rules are matched by segmenting the word into flagged stems.

Before any of that, a word is tested against bitmaps of the two-character sequences that can start and end an accepted word (derived from the stems and affixes when the dictionary loads). Most of the hundreds of thousands of candidate strings that `suggest()` generates fail this test and are rejected without a single hash lookup.

Demo
====
There's a live demo of Typo.js at https://www.chrisfinke.com/files/typo-demo/ and a complete Node.js example file at https://github.com/cfinke/Typo.js/blob/master/examples/node/index.js

Development
===========
The full TypeScript source code and unit test suites are available in the official Typo.js repository at https://github.com/cfinke/Typo.js

In the repository, the source is a single module, `ts/typo.ts`. To modify Typo.js, make your changes there and then run `build.sh` (after `npm install`) to generate `typo/typo.js` (classic browser script that also works with `require()`), `typo/typo.mjs` (ES module), and their type declarations, `typo/typo.d.ts` and `typo/typo.d.mts`.

```sh
npm install           # esbuild, typescript
npm run build         # ./build.sh
npm test              # runs the test suites listed in tests/run.js, then tests/async-environments.js, in Node.js
```

The test suites also run in a browser: load the repository as an unpacked Chrome extension and open `tests/index.html` from it. The `manifest.json` file in the root of the repository exists only for that; it has no purpose if you're using Typo.js in your own project.

Licensing
=========

Typo.js is free software, licensed under the Modified BSD License.
