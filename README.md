Typo.js is a Typescript port of [Typo.js spellchecker](https://github.com/cfinke/Typo.js)

# Usage

To use Typo in a Chrome extension, simply include the typo.js file in your extension's background page, and then initialize the dictionary like so:
This is designed to be used within a web application and I removed the original dictionary table building.
For Typo to work it needs the dictionary data already parsed and supplied to the constructor instead of the language string or .aff/.dic files, including:

The dictionaryTable including all words and rule sets
The compoundRules RegExp array
The replacementTable array pairs
The Hunspell affix flags object

```javascript
const Typo = require("typo-js");
const dictionary = new Typo(...);
```

To check if a word is spelled correctly, do this:

```javascript
const is_spelled_correctly = dictionary.check("mispelled");
```

To get suggested corrections for a misspelled word, do this:

```javascript
const array_of_suggestions = dictionary.suggest("mispeling");

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

# Licensing

Typo.js is free software, licensed under the Modified BSD License.
