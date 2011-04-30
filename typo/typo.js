/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style 
 * dictionaries.
 *
 * You can choose the backend implementation by setting this.implementation:
 *
 *   - hash: Stores the dictionary words as the keys of a hash and does a key
 *           existence check to determine whether a word is spelled correctly.
 *           Lookups are very fast, but this method uses the most memory.
 * 
 *   - binarysearch: stores the dictionary words in a series of strings and 
 *                   uses binary search to check whether a word exists in the 
 *                   dictionary. It uses less memory than the hash implementa-
 *                   tion, but lookups are slower.
 *
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

var Typo = function (dictionary, affData, wordsData, implementation) {
	if (!implementation) implementation = "hash";
	
	this.implementation = implementation;
	
	/** Determines the method used for auto-loading .aff and .dic files. **/
	this.platform = "chrome";
	
	this.dictionary = null;
	
	this.rules = {};
	this.dictionaryTable = {};
	
	this.compoundRules = [];
	this.compoundRuleCodes = {};
	
	this.flags = {};
	
	if (dictionary) {
		this.dictionary = dictionary;
		
		if (this.platform == "chrome") {
			if (!affData) affData = this._readFile(chrome.extension.getURL("lib/typo/dictionaries/" + dictionary + "/" + dictionary + ".aff"));
			if (!wordsData) wordsData = this._readFile(chrome.extension.getURL("lib/typo/dictionaries/" + dictionary + "/" + dictionary + ".dic"));
		}
		
		this.rules = this._parseAFF(affData);
		
		// Save the rule codes that are used in compound rules.
		this.compoundRuleCodes = {};
		
		for (var i = 0, _len = this.compoundRules.length; i < _len; i++) {
			var rule = this.compoundRules[i];
			
			for (var j = 0, _jlen = rule.length; j < _jlen; j++) {
				this.compoundRuleCodes[rule[j]] = [];
			}
		}
		
		// If we add this ONLYINCOMPOUND flag to this.compoundRuleCodes, then _parseDIC
		// will do the work of saving the list of words that are compound-only.
		if ("ONLYINCOMPOUND" in this.flags) {
			this.compoundRuleCodes[this.flags.ONLYINCOMPOUND] = [];
		}
		
		this.dictionaryTable = this._parseDIC(wordsData);
		
		// Get rid of any codes from the compound rule codes that are never used 
		// (or that were special regex characters).  Not especially necessary... 
		for (var i in this.compoundRuleCodes) {
			if (this.compoundRuleCodes[i].length == 0) {
				delete this.compoundRuleCodes[i];
			}
		}
		
		// Build the full regular expressions for each compound rule.
		// I have a feeling (but no confirmation yet) that this method of 
		// testing for compound words is probably slow.
		for (var i = 0, _len = this.compoundRules.length; i < _len; i++) {
			var ruleText = this.compoundRules[i];
			
			var expressionText = "";
			
			for (var j = 0, _jlen = ruleText.length; j < _jlen; j++) {
				var character = ruleText[j];
				
				if (character in this.compoundRuleCodes) {
					expressionText += "(" + this.compoundRuleCodes[character].join("|") + ")";
				}
				else {
					expressionText += character;
				}
			}
			
			this.compoundRules[i] = new RegExp(expressionText, "i");
		}
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
	 * @param {String} [charset="ISO8859-1"] The expected charset of the file
	 * @returns string The file data.
	 */
	
	_readFile : function (path, charset) {
		if (!charset) charset = "ISO8859-1";
		
		var req = new XMLHttpRequest();
		req.open("GET", path, false);
		req.overrideMimeType("text/plain; charset=" + charset);
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
					entry.add = charactersToAdd;
					
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
			else if (ruleType === "COMPOUNDRULE") {
				var numEntries = parseInt(definitionParts[1], 10);
				
				for (var j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					var line = lines[j];
					
					var lineParts = line.split(/\s+/);
					this.compoundRules.push(lineParts[1]);
				}
				
				i += numEntries;
			}
			else {
				// ONLYINCOMPOUND
				// COMPOUNDMIN
				// FLAG
				
				this.flags[ruleType] = definitionParts[1];
			}
		}
		
		return rules;
	},
	
	/**
	 * Parses the words out from the .dic file.
	 *
	 * @param {String} data The data from the dictionary file.
	 * @returns object The implementation-specific dictionary.
	 */
	
	_parseDIC : function (data) {
		if (this.implementation == "binarysearch") {
			return this._parseDICBinarySearch(data);
		}
		else {
			return this._parseDICHash(data);
		}
	},
	
	/**
	 * Parses the .dic file and returns a hash of all of the words within.
	 *
	 * @param {String} data The contents of the .dic file.
	 * @returns {Object} The hash of all of the words from the .dic file.
	 */
	
	_parseDICHash : function (data) {
		var lines = data.split("\n");
		var dictionaryTable = {};
		
		// The first line is the number of words in the dictionary.
		for (var i = 1, _len = lines.length; i < _len; i++) {
			var line = lines[i];
			
			var parts = line.split("/", 2);
			
			var word = parts[0];
			
			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodesArray = this.parseRuleCodes(parts[1]);
				
				// Save the ruleCodes for compound word situations.
				dictionaryTable[word] = ruleCodesArray;
				
				for (var j = 0, _jlen = ruleCodesArray.length; j < _jlen; j++) {
					var code = ruleCodesArray[j];
					
					var rule = this.rules[code];
					
					if (rule) {
						var newWords = this._applyRule(word, rule);
						
						for (var ii = 0, _iilen = newWords.length; ii < _iilen; ii++) {
							var newWord = newWords[ii];
						
							dictionaryTable[newWord] = "";
							
							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodesArray[k];
									
									var combineRule = this.rules[combineCode];
									
									if (combineRule) {
										if (combineRule.combineable && (rule.type != combineRule.type)) {
											var otherNewWords = this._applyRule(newWord, combineRule);
											
											for (var iii = 0, _iiilen = otherNewWords.length; iii < _iiilen; iii++) {
												var otherNewWord = otherNewWords[iii];
												dictionaryTable[otherNewWord] = "";
											}
										}
									}
								}
							}
						}
					}
					
					if (code in this.compoundRuleCodes) {
						this.compoundRuleCodes[code].push(word);
					}
				}
			}
			else {
				dictionaryTable[word] = "";
			}
		}
		
		return dictionaryTable;
	},
	
	parseRuleCodes : function (textCodes) {
		if (!textCodes) {
			return [];
		}
		else if (!("FLAG" in this.flags)) {
			return textCodes.split("");
		}
		else if (this.flags.FLAG === "long") {
			var flags = [];
			
			for (var i = 0, _len = textCodes.length; i < _len; i += 2) {
				flags.push(textCodes.substring(i, 2));
			}
			
			return flags;
		}
		else if (this.flags.FLAG === "num") {
			return textCode.split(",");
		}
	},
	
	/**
	 * Parses the .dic file and generates an array containing the concat-
	 * enations of all words of identical length. array[1] will contain all
	 * words of length 1, array[2] all words of length 2, and so on.
	 *
	 * @param {String} data The contents of the .dic file.
	 * @returns {String[]} The array of word sets.
	 */
	
	_parseDICBinarySearch : function (data) {
		var lines = data.split("\n");
		
		var patternTable = {};
		
		// The first line is the number of words in the dictionary.
		for (var i = 0, _len = lines.length; i < _len; i++) {
			var line = lines[i];
			
			var parts = line.split("/", 2);
			
			var word = parts[0];
			
			if (!(word.length in patternTable)) patternTable[word.length] = [];
			patternTable[word.length].push(word);
			
			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodesArray = this.parseRuleCodes(parts[1]);
				
				for (var j = 0, _jlen = ruleCodesArray.length; j < _jlen; j++) {
					var code = ruleCodesArray[j];
					var rule = this.rules[code];
					
					if (rule) {
						var newWords = this._applyRule(word, rule);
						
						for (var ii = 0, _iilen = newWords.length; ii < _iilen; ii++) {
							var newWord = newWords[ii];
							
							if (!(newWord.length in patternTable)) patternTable[newWord.length] = [];
							patternTable[newWord.length].push(newWord);
							
							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodesArray[k];
									
									if (combineCode in this.rules) {
										var combineRule = this.rules[combineCode];
										
										if ((rule.type != combineRule.type) && combineRule.combineable) {
											var otherNewWords = this._applyRule(newWord, combineRule);
											
											for (var iii = 0, _iiilen = otherNewWords.length; iii < _iiilen; iii++) {
												var otherNewWord = otherNewWords[iii];
												if (!(otherNewWord.length in patternTable)) patternTable[otherNewWord.length] = [];
												patternTable[otherNewWord.length].push(otherNewWord);
											}
										}
									}
								}
							}
						}
					}
					
					if (code in this.compoundRuleCodes) {
						this.compoundRuleCodes[code].push(word);
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
	 * @param {Object} rule The affix rule.
	 * @returns {String[]} The new words generated by the rule.
	 */
	
	_applyRule : function (word, rule) {
		var entries = rule.entries;
		var newWords = [];
		
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
				
				newWords.push(newWord);
			}
		}
		
		return newWords;
	},
	
	/**
	 * Checks whether a word or a capitalization variant exists in the current dictionary.
	 * The word is trimmed and several variations of capitalizations are checked.
	 * If you want to check a word without any changes made to it, call checkExact()
	 *
	 * @param {String} aWord The word to check.
	 * @returns {Boolean}
	 */
	
	check : function (aWord) {
		// Remove leading and trailing whitespace
		var trimmedWord = aWord.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		
		if (this.checkExact(trimmedWord)) {
			return true;
		}
		
		// The exact word is not in the dictionary.
		
		if (trimmedWord.toUpperCase() === trimmedWord) {
			// The word was supplied in all uppercase.
			// Check for a capitalized form of the word.
			// @todo Support for the KEEPCASE flag
			var capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();
			
			if (this.checkExact(capitalizedWord)) {
				return true;
			}
		}
		
		var lowercaseWord = trimmedWord.toLowerCase();
		
		if (lowercaseWord !== trimmedWord) {
			// Check for a lowercase form
			if (this.checkExact(lowercaseWord)) {
				return true;
			}
		}
		
		return false;
	},
	
	/**
	 * Checks whether a word exists in the current dictionary.
	 *
	 * @see http://blog.stevenlevithan.com/archives/faster-trim-javascript re:trimming function
	 *
	 * @param {String} word The word to check.
	 * @returns {Boolean}
	 */
	
	checkExact : function (word) {
		var rv = false;
		
		if (this.implementation == "binarysearch") {
			rv = this._checkBinaryString(word);
			
			if (!rv) {
				if ("COMPOUNDMIN" in this.flags && word.length >= this.flags.COMPOUNDMIN) {
					for (var i = 0, _len = this.compoundRules.length; i < _len; i++) {
						if (word.match(this.compoundRules[i])) {
							rv = true;
							break;
						}
					}
				}
			}
			else {
				if ("ONLYINCOMPOUND" in this.flags && this.compoundRuleCodes[this.flags.ONLYINCOMPOUND].indexOf(word) !== -1) {
					rv = false;
				}
			}
		}
		else {
			rv = this._checkHash(word);
		}
		
		return rv;
	},
	
	/**
	 * Hash implementation of check()
	 *
	 * @param {String} word The word to check.
	 * @returns {Boolean}
	 */
	
	_checkHash : function (word) {
		var ruleCodes = this.dictionaryTable[word];
		
		if (typeof ruleCodes === 'undefined') {
			// Check if this might be a compound word.
			if ("COMPOUNDMIN" in this.flags && word.length >= this.flags.COMPOUNDMIN) {
				for (var i = 0, _len = this.compoundRules.length; i < _len; i++) {
					if (word.match(this.compoundRules[i])) {
						return true;
					}
				}
			}
			
			return false;
		}
		else {
			if ("ONLYINCOMPOUND" in this.flags && ruleCodes.indexOf(this.flags.ONLYINCOMPOUND) != -1) {
				return false;
			}
			
			return true;
		}
	},
	
	/**
	 * Binary search implementation of check()
	 *
	 * Code originally written by "Randall"
	 * @see http://ejohn.org/blog/revised-javascript-dictionary-search/
	 *
	 * @param {String} word The word to check.
	 * @returns {Boolean}
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
	 * @see http://www.norvig.com/spell-correct.html for the basis of this suggestor.
	 * This suggestor is primitive, but it works.
	 *
	 * @param {String} word The misspelling.
	 * @param {Number} [limit=5] The maximum number of suggestions to return.
	 * @returns {String[]} The array of suggestions.
	 */
	
	alphabet : "",
	
	suggest : function (word, limit) {
		if (!limit) limit = 5;
		
		if (this.check(word)) return [];
		
		word = word;
		
		var self = this;
		self.alphabet = "abcdefghijklmnopqrstuvwxyz";
		/*
		if (!self.alphabet) {
			// Use the alphabet as implicitly defined by the words in the dictionary.
			var alphaHash = {};
			
			for (var i in self.dictionaryTable) {
				if (self.implementation === 'binarysearch') var example = self.dictionaryTable[i];
				else var example = i;
				
				for (var j = 0, _len = example.length; j < _len; j++) {
					alphaHash[example[j]] = true;
				}
			}
			
			for (var i in alphaHash) {
				self.alphabet += i;
			}
			
			var alphaArray = self.alphabet.split("");
			alphaArray.sort();
			self.alphabet = alphaArray.join("");
		}
		*/
		function edits1(words) {
			var rv = [];
			
			for (var ii = 0, _iilen = words.length; ii < _iilen; ii++) {
				var word = words[ii];
				
				var splits = [];
			
				for (var i = 0, _len = word.length + 1; i < _len; i++) {
					splits.push([ word.substring(0, i), word.substring(i, word.length) ]);
				}
			
				var deletes = [];
			
				for (var i = 0, _len = splits.length; i < _len; i++) {
					var s = splits[i];
				
					if (s[1]) {
						deletes.push(s[0] + s[1].substring(1));
					}
				}
			
				var transposes = [];
			
				for (var i = 0, _len = splits.length; i < _len; i++) {
					var s = splits[i];
				
					if (s[1].length > 1) {
						transposes.push(s[0] + s[1][1] + s[1][0] + s[1].substring(2));
					}
				}
			
				var replaces = [];
			
				for (var i = 0, _len = splits.length; i < _len; i++) {
					var s = splits[i];
				
					if (s[1]) {
						for (var j = 0, _jlen = self.alphabet.length; j < _jlen; j++) {
							replaces.push(s[0] + self.alphabet[j] + s[1].substring(1));
						}
					}
				}
			
				var inserts = [];
			
				for (var i = 0, _len = splits.length; i < _len; i++) {
					var s = splits[i];
				
					if (s[1]) {
						for (var j = 0, _jlen = self.alphabet.length; j < _jlen; j++) {
							replaces.push(s[0] + self.alphabet[j] + s[1]);
						}
					}
				}
			
				rv = rv.concat(deletes);
				rv = rv.concat(transposes);
				rv = rv.concat(replaces);
				rv = rv.concat(inserts);
			}
			
			return rv;
		}
		
		function known(words) {
			var rv = [];
			
			for (var i = 0; i < words.length; i++) {
				if (self.check(words[i])) {
					rv.push(words[i]);
				}
			}
			
			return rv;
		}
		
		function correct(word) {
			// Get the edit-distance-1 and edit-distance-2 forms of this word.
			var ed1 = edits1([word]);
			var ed2 = edits1(ed1);
			
			var corrections = known(ed1).concat(known(ed2));
			
			// Sort the edits based on how many different ways they were created.
			var weighted_corrections = {};
			
			for (var i = 0, _len = corrections.length; i < _len; i++) {
				if (!(corrections[i] in weighted_corrections)) {
					weighted_corrections[corrections[i]] = 1;
				}
				else {
					weighted_corrections[corrections[i]] += 1;
				}
			}
			
			var sorted_corrections = [];
			
			for (var i in weighted_corrections) {
				sorted_corrections.push([ i, weighted_corrections[i] ]);
			}
			
			function sorter(a, b) {
				if (a[1] < b[1]) {
					return -1;
				}
				
				return 1;
			}
			
			sorted_corrections.sort(sorter).reverse();
			
			var rv = [];
			
			for (var i = 0, _len = Math.min(limit, sorted_corrections.length); i < _len; i++) {
				rv.push(sorted_corrections[i][0]);
			}
			
			return rv;
		}
		
		return correct(word);
	}
};