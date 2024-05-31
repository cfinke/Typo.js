Typo.js is a JavaScript/TypeScript spellchecker that uses Hunspell-style dictionaries.

Usage
=====

To use Typo in a Chrome extension, simply include the typo.js file in your extension's background page, and then initialize the dictionary like so:

```javascript
var dictionary = new Typo("en_US");
```

To use Typo in a standard web application you need to pass a settings object that provides a path to the folder containing the desired dictionary.

```javascript
var dictionary = new Typo("en_US", false, false, { dictionaryPath: "typo/dictionaries" }),
```

If using in node.js, load it like so:

```javascript
var Typo = require("typo-js");
var dictionary = new Typo([...]);
```

To check if a word is spelled correctly, do this:

```javascript
var is_spelled_correctly = dictionary.check("mispelled");
```

To get suggested corrections for a misspelled word, do this:

```javascript
var array_of_suggestions = dictionary.suggest("mispeling");

// array_of_suggestions == ["misspelling", "dispelling", "misdealing", "misfiling", "misruling"]
```

Typo.js has full support for the following Hunspell affix flags:

* PFX
* SFX
* REP
* FLAG
* COMPOUNDMIN
* COMPOUNDRULE
* ONLYINCOMPOUND
* KEEPCASE
* NOSUGGEST
* NEEDAFFIX

_Note: The manifest.json file in the root directory of the project is there to simplify testing, as it allows you to load all of the files in the Typo project as a Chrome extension. It doesn't have any purpose if you're using Typo.js in your own project._

Demo
====
There's a live demo of Typo.js at http://www.chrisfinke.com/files/typo-demo/ and a complete Node.js example file at examples/node/index.js.

Development
===========
The full TypeScript source code and unit test suites are available in the official Typo.js repository at https://github.com/cfinke/Typo.js

To modify Typo.js, make your changes to `ts/typo.ts` and then run `build.sh` to generate the JavaScript file `typo/typo.js`.

IRL
===
Typo.js has been been used all over in real-world projects, but here are a few examples:

* [Parola](https://apps.apple.com/us/app/parola/id6474320336), a mobile word puzzle game
* [A number of NPM packages](https://www.npmjs.com/browse/depended/typo-js)

Licensing
=========

Typo.js is free software, licensed under the Modified BSD License.
