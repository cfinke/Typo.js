Typo.js is a JavaScript spellchecker that uses Hunspell-style dictionaries.  Its main use is to allow Chrome extensions to perform client-side spellchecking.

Usage
=====

To use Typo, simply include the typo.js file in your extension's background page, and then initialize the dictionary like so:

```javascript
var dictionary = new Typo("en_US");
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

Licensing
=========

Typo.js is free software, licensed under the Modified BSD License.