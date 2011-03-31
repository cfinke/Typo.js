Typo.js is a JavaScript spellchecker that uses Hunspell-style dictionaries.

You can choose the backend implementation by setting this.implementation:

  - hash: Stores the dictionary words as the keys of a hashand does a key
          existence check to determine whether a word is spelled correctly.
          Lookups are very fast, but this method uses the most memory.
 
  - binarysearch: stores the dictionary words in a series of strings and 
                  uses binary search to check whether a word exists in the 
                  dictionary. It uses less memory than the hash implementa-
                  tion, but lookups are slower.