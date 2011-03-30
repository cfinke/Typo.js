/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style 
 * dictionaries.
 *
 * You can choose the backend implementation by setting this.implementation:
 *
 *   - hash: Stores the dictionary words as the keys of a hashand does a key
 *           existence check to determine whether a word is spelled correctly.
 *           Lookups are very fast, but this method uses the most memory.
 * 
 *   - binarysearch: stores the dictionary words in a series of strings and 
 *                   uses binary search to check whether a word exists in the 
 *                   dictionary. It uses less memory than the hash implementa-
 *                   tion, but lookups are slower.
 *
 * @todo Implement COMPOUNDRULE
 * @todo Implement suggestions.
 */

/**
 * Typo constructor.
 *
 * @param {String} [dictionary] The locale code of the dictionary being used. e.g.,
 *                              "en_US". This is only used to auto-load dictionaries.
 * @param {String} [affData] The data from the dictionary's .aff file. If omitted
 *                           and the first argument is supplied, the .aff file will
 *                           be loaded automatically from lib/typo/dictionaries/[dictionary]/[dictionary].aff
 * @param {String} [wordsData] The data from the dictionary's .dic file. If omitted,
 *                             and the first argument is supplied, the .dic file will
 *                             be loaded automatically from lib/typo/dictionaries/[dictionary]/[dictionary].dic
 * @returns {Typo} A Typo object.
 */

var Typo = function (dictionary, affData, wordsData) {
	this.implementation = "hash";
	
	/** Determines the method used for auto-loading .aff and .dic files. **/
	this.platform = "chrome";
	
	this.dictionary = null;
	this.rules = {};
	this.dictionaryTable = {};
	
	this.compoundRules = [];
	this.flags = {};
	
	if (dictionary) {
		this.dictionary = dictionary;
		
		if (this.platform == "chrome") {
			if (!affData) affData = this._readFile(chrome.extension.getURL("lib/typo/dictionaries/" + dictionary + "/" + dictionary + ".aff"));
			if (!wordsData) wordsData = this._readFile(chrome.extension.getURL("lib/typo/dictionaries/" + dictionary + "/" + dictionary + ".dic"));
		}
		
		this.rules = this._parseAFF(affData);
		this.dictionaryTable = this._parseDIC(wordsData);
	}
	
	return this;
};

Typo.prototype = {
	/**
	 * Loads a Typo instance from a hash of all of the Typo properties.
	 *
	 * @param object obj A hash of Typo properties, probably gotten from a JSON.parse(JSON.stringify(typo_instance)).
	 */
	
	load : function (obj) {
		for (var i in obj) {
			this[i] = obj[i];
		}
		
		return this;
	},
	
	/**
	 * Read the contents of a file.
	 * 
	 * @param {String} path The path (relative) to the file.
	 * @returns string The file data.
	 */
	
	_readFile : function (path) {
		var req = new XMLHttpRequest();
		req.open("GET", path, false);
		req.send(null);
		
		return req.responseText;
	},
	
	/**
	 * Parse the rules out from a .aff file.
	 *
	 * @param {String} data The contents of the affix file.
	 * @returns object The rules from the file.
	 */
	
	_parseAFF : function (data) {
		var rules = {};
		
		// Remove comment lines
		data = data.replace(/\n#[^\n]*\n/g, "\n");
		
		// Remove blank lines
		data = data.replace(/\n{2,}/g, "\n");
		
		var lines = data.split("\n");
		
		for (var i = 0, _len = lines.length; i < _len; i++) {
			var line = lines[i];
			
			var definitionParts = line.split(/\s+/);
			
			var ruleType = definitionParts[0];
			
			if (ruleType == "PFX" || ruleType == "SFX") {
				var ruleCode = definitionParts[1];
				var combineable = definitionParts[2];
				var numEntries = parseInt(definitionParts[3], 10);
				
				var entries = [];
				
				for (var j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					var line = lines[j];
					
					var lineParts = line.split(/\s+/);
					var charactersToRemove = lineParts[2];
					var charactersToAdd = lineParts[3];
					var regexToMatch = lineParts[4];
					
					var entry = {};
					entry.add = charactersToAdd.toLowerCase();
					
					if (regexToMatch !== ".") {
						if (ruleType === "SFX") {
							entry.match = new RegExp(regexToMatch + "$");
						}
						else {
							entry.match = new RegExp("^" + regexToMatch);
						}
					}
					
					if (charactersToRemove != "0") {
						if (ruleType === "SFX") {
							entry.remove = new RegExp(charactersToRemove  + "$");
						}
						else {
							entry.remove = charactersToRemove;
						}
					}
					
					entries.push(entry);
				}
				
				rules[ruleCode] = { "type" : ruleType, "combineable" : (combineable == "Y"), "entries" : entries };
				
				i += numEntries;
			}
			else if (ruleType === "ONLYINCOMPOUND") {
				this.flags.onlyincompound = definitionParts[1];
			}
			else if (ruleType === "COMPOUNDRULE") {
				var numEntries = parseInt(definitionParts[1], 10);
				
				for (var j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					var line = lines[j];
					
					var lineParts = line.split(/\s+/);
					this.compoundRules.push(lineParts[1]);
				}
				
				i += numEntries;
			}
		}
		
		return rules;
	},
	
	/**
	 * Creates a hashtable of all the possible words in this dictionary, based on the .dic and the .aff.
	 *
	 * @param {String} data The data from the dictionary file.
	 * @returns object The dictionary hash.
	 */
	
	_parseDIC : function (data) {
		if (this.implementation == "binarysearch") {
			return this._parseDICBinarySearch(data);
		}
		else {
			return this._parseDICHash(data);
		}
	},
	
	_parseDICHash : function (data) {
		// @todo Support ONLYINCOMPOUND
		
		var lines = data.split("\n");
		var dictionaryTable = {};
		
		// The first line is the number of words in the dictionary.
		for (var i = 1, _len = lines.length; i < _len; i++) {
			var line = lines[i];
			
			var parts = line.split("/", 2);
			
			var word = parts[0].toLowerCase();
			
			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodes = parts[1];
				
				// Save the ruleCodes for compound word situations.
				dictionaryTable[word] = ruleCodes;
				
				for (var j = 0, _jlen = ruleCodes.length; j < _jlen; j++) {
					var code = ruleCodes[j];
					
					var rule = this.rules[code];
					
					if (rule) {
						var newWord = this._applyRule(word, rule);
						
						if (newWord) {
							dictionaryTable[newWord] = true;
							
							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodes[k];
									
									var combineRule = this.rules[combineCode];
									
									if (combineRule) {
										if (combineRule.combineable && (rule.type != combineRule.type)) {
											var otherNewWord = this._applyRule(newWord, combineRule);
											
											if (otherNewWord) {
												dictionaryTable[otherNewWord] = true;
											}
										}
									}
								}
							}
						}
					}
				}
			}
			else {
				dictionaryTable[word] = true;
			}
		}
		
		return dictionaryTable;
	},
	
	_parseDICBinarySearch : function (data) {
		var lines = data.split("\n");
		
		var patternTable = {};
		
		// The first line is the number of words in the dictionary.
		for (var i = 0, _len = lines.length; i < _len; i++) {
			var line = lines[i];
			
			var parts = line.split("/", 2);
			
			var word = parts[0].toLowerCase();
			
			if (!(word.length in patternTable)) patternTable[word.length] = [];
			patternTable[word.length].push(word);
			
			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodes = parts[1];
				
				for (var j = 0, _jlen = ruleCodes.length; j < _jlen; j++) {
					var code = ruleCodes[j];
					
					if (code in this.rules) {
						var rule = this.rules[code];
						
						var newWord = this._applyRule(word, rule);
						
						if (newWord) {
							if (!(newWord.length in patternTable)) patternTable[newWord.length] = [];
							patternTable[newWord.length].push(newWord);
							
							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodes[k];
									
									if (combineCode in this.rules) {
										var combineRule = this.rules[combineCode];
										
										if ((rule.type != combineRule.type) && combineRule.combineable) {
											var otherNewWord = this._applyRule(newWord, combineRule);
											
											if (otherNewWord) {
												if (!(otherNewWord.length in patternTable)) patternTable[otherNewWord.length] = [];
												patternTable[otherNewWord.length].push(otherNewWord);
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
		
		function unique(arr) {
			var narr = [];
			
			for (var i = 0, _len = arr.length; i < _len; i++) {
				if (i === 0) {
					narr.push(arr[0]);
				}
				else {
					if (arr[i-1] !== arr[i]) {
						narr.push(arr[i]);
					}
				}
			}
			
			return narr;
		}
		
		for (var i in patternTable) {
			patternTable[i].sort();
			
			patternTable[i] = unique(patternTable[i]).join("");
		}
		
		return patternTable;
	},
	
	/**
	 * Applies an affix rule to a word.
	 *
	 * @param {String} word The base word.
	 * @param object rule The affix rule.
	 * @returns string The new word generated by the rule.
	 */
	
	_applyRule : function (word, rule) {
		var entries = rule.entries;
		
		for (var i = 0, _len = entries.length; i < _len; i++) {
			var entry = entries[i];
			
			if (!entry.match || word.match(entry.match)) {
				var newWord = word;
				
				if (entry.remove) {
					newWord = newWord.replace(entry.remove, "");
				}
				
				if (rule.type === "SFX") {
					newWord = newWord + entry.add;
				}
				else {
					newWord = entry.add + newWord;
				}
				
				return newWord;
			}
		}
		
		return false;
	},
	
	/**
	 * Checks whether a word exists in the current dictionary.
	 *
	 * @param {String} word The word to check.
	 * @returns boolean
	 */
	
	check : function (word) {
		word = word.toLowerCase();
		
		if (this.implementation == "binarysearch") {
			return this._checkBinaryString(word);
		}
		else {
			return this._checkHash(word);
		}
	},
	
	_checkHash : function (word) {
		return (word in this.dictionaryTable);
	},
	
	/**
	 * Code originally written by "Randall"
	 * @see http://ejohn.org/blog/revised-javascript-dictionary-search/
	 */
	
	_checkBinaryString : function (word) {
		var dict = this.dictionaryTable;
		
		// Figure out which bin we're going to search
		var l = word.length;
		
		// Don't search if there's nothing to look through
		if ( !dict[l] ) {
			return false;
		}
		
		// Get the number of words in the dictionary bin
		var words = dict[l].length / l,
			// The low point from where we're starting the binary search
			low = 0,
			
			// The max high point
			high = words - 1,
			
			// And the precise middle of the search
			mid = Math.floor( words / 2 );
			
		// We continue to look until we reach a final word
		while ( high >= low ) {
			// Grab the word at our current position
			var found = dict[l].substr( l * mid, l );
			
			// If we've found the word, stop now
			if ( word === found ) {
				return true;
			}
			
			// Otherwise, compare
			// If we're too high, move lower
			if ( word < found ) {
				high = mid - 1;
				// If we're too low, go higher
			} else {
				low = mid + 1;
			}
			
			// And find the new search point
			mid = Math.floor( (low + high) / 2 );
		}
		
		// Nothing was found
		return false;
	},
	
	/**
	 * Returns a list of suggestions for a misspelled word.
	 *
	 * @todo Not yet implemented.
	 *
	 * @param {String} word The misspelling.
	 * @returns {String[]} The array of suggestions.
	 */
	
	suggest : function (word) {
		throw "suggest not implemented.";
	}
};