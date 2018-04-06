Typo.js is a JavaScript spellchecker that uses Hunspell-style dictionaries.

Usage
=====

Simple Loading
--------------

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


Faster Loading
--------------

If you care about memory or cpu usage, you should try this method.

The above methods load the dictionary from hunspell compatible `.dic` and `.aff` files. But if you are using node.js or are using a bundler that supports `require(...)`, you can load dictionaries for fast and memory efficient zero-copy-ish files that are precomputed using a script

To load en_US with the included precomputed dictionary files:

```javascript
var Typo = require("typo-js");
var dictionary = new Typo();
dictionary.loadPrecomputed([...]); // Supports most of the same settings as the constructor
```

Assuming you installed this as a node module, if you have some other set of `.aff` and `.dic` files, precompute the `.sst` and `.json` files used by the above technique by running:

`./node_modules/.bin/typo-precompute [en_US|other_code] [path/to/dictionaries]` using your terminal in your project's root folder

NOTE: The precompute script will require a lot of memory if processing a large dictionary.



Methods
-------

To check if a word is spelled correctly, do this:

```javascript
var is_spelled_correctly = dictionary.check("mispelled");
```

To get suggested corrections for a misspelled word, do this:
	
```javascript
var array_of_suggestions = dictionary.suggest("mispeling");

// array_of_suggestions == ["misspelling", "dispelling", "misdealing", "misfiling", "misruling"]
```

Compatibility
-------------

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

Licensing
=========

Typo.js is free software, licensed under the Modified BSD License.