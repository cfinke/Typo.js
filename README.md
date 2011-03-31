Typo.js is a JavaScript spellchecker that uses Hunspell-style dictionaries.  Its main use is to allow Chrome extensions to perform client-side spellchecking.

To use Typo, simply include the typo.js file in your extension's background page, and then initialize the dictionary like so:

	var dictionary = new Typo("en_US");

To check if a word is spelled correctly, do this:

	var is_spelled_correctly = dictionary.check("mispelled");

You can choose the backend implementation by setting dictionary.implementation in typo.js:

* hash

	Stores the dictionary words as the keys of a hashand does a key existence check to determine whether a word is spelled correctly. Lookups are very fast, but this method uses the most memory.
 
* binarysearch

	Stores the dictionary words in a series of strings and uses binary search to check whether a word exists in the dictionary. It uses less memory than the hash implementation, but lookups are slower.