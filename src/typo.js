/* globals chrome: false */
/* globals __dirname: false */
/* globals require: false */
/* globals Buffer: false */
/* globals module: false */

/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style
 * dictionaries.
 */

var Typo;

(function () {
"use strict";

/**
 * Typo constructor.
 *
 * @returns {Typo} A Typo object.
 */

Typo = function () {

	this.dictionary = null;

	this.rules = {};
	this.dictionaryTable = {};

	this.compoundRules = [];
	this.compoundRuleCodes = {};

	this.replacementTable = [];

	this.flags = {};

	this.memoized = {};

	if(arguments.length > 0) {
		this.load.apply(this, arguments);
	}


	return this;
};

Typo.prototype = {

	/**
	 * Loads a Typo instance from a hash of all of the Typo properties.
	 *
	 * @param object obj A hash of Typo properties, probably gotten from a JSON.parse(JSON.stringify(typo_instance)).
	 */

	loadRaw : function (obj) {
		for (var i in obj) {
			if (obj.hasOwnProperty(i)) {

				if(i === 'compoundRules') {
					obj[i] = obj[i].map((r) => {
						var m = r.match(/\/(.*)\/(.*)?/);
						return new RegExp(m[1], m[2] || '');
					});
				}

				this[i] = obj[i];
			}
		}

		return this;
	},

	/**
	 * Similar to load() except loads the precomputed .json and .sst files 
	 * 
	 * NOTE: This is currently only supported in environments with require()
	 * NOTE: In order to create these files see the 'bin/precompute-dic.js' script with usage in the README.
	 * NOTE: sstData if given is expected as 
	 * 
	 * @param {String} dictionary The locale code of the dictionary being used. e.g.,
	 *                               "en_US". This is only used to auto-load dictionaries.
	 * @param {String} [jsonData]    The data from the dictionary's .json file. If omitted
	 *                               and Typo.js is being used in a Chrome extension, the .json
	 *                               file will be loaded automatically from
	 *                               lib/typo/dictionaries/[dictionary]/[dictionary].json
	 *                               In other environments, it will be loaded from
	 *                               [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].json
	 * @param {ArrayBuffer} [sstData] The data from the dictionary's .sst file. If omitted
	 *                               and Typo.js is being used in a Chrome extension, the .sst
	 *                               file will be loaded automatically from
	 *                               lib/typo/dictionaries/[dictionary]/[dictionary].sst
	 *                               In other environments, it will be loaded from
	 *                               [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].sst
     * @param {Object} [settings]    Loader settings. Available properties are:
	 *                               {String} [dictionaryPath]: path to load dictionary from in non-chrome
	 *                               environment.
	 *                               {Boolean} [asyncLoad]: If true, affData and wordsData will be loaded
	 *                               asynchronously.
	 *                               {Function} [loadedCallback]: Called when both affData and wordsData
	 *                               have been loaded. Only used if asyncLoad is set to true. The parameter
	 *                               is the instantiated Typo object.
	 */
	loadPrecomputed : function (dictionary, jsonData, sstData, settings) {

		var SSTable = require('sstab/src/sstable');


		settings = settings || {};


		if(!jsonData) {
			jsonData = this._readFile(this._resolveFilePath(dictionary, 'json', settings.dictionaryPath), 'utf8', settings.asyncLoad);
		}
		else if(settings.asyncLoad) {
			jsonData = Promise.resolve(jsonData);
		}

		if(!sstData) {
			sstData = this._readFile(this._resolveFilePath(dictionary, 'sst', settings.dictionaryPath), null, settings.asyncLoad, true);
		}
		else if(settings.asyncLoad) {
			sstData = Promise.resolve(sstData);
		}


		
		var self = this;


		if(settings.asyncLoad) {
			Promise.all([jsonData, sstData]).then(function(values) {
				jsonData = values[0];
				sstData = values[1];
				finishLoading();
			});
		}
		else {
			finishLoading();
		}



		function finishLoading() {

			var props = JSON.parse(jsonData);

			self.loadRaw(props);

			var table = new SSTable(sstData);

			self.dictionaryTable = table;
			self._getDictionaryEntry = function(k) {
			
				var s = self.dictionaryTable.get(k);
				if(s === undefined) {
					return s;
				}
				else if (s == '') {
					return null;
				}
			
				return [s.split('')];
			}


			if(settings.asyncLoad && settings.loadedCallback) {
				settings.loadedCallback(self);
			}

		}

	},


	/**
	 * Loads the library from remote files
	 * 
	 * NOTE: If a character set is given on the .aff file and it is not ISO8859-1, then it must be manually given as a setting. This library currently does not support automatic parsing of that setting.
	 * 
	 * @param {String} dictionary The locale code of the dictionary being used. e.g.,
	 *                              "en_US". This is only used to auto-load dictionaries.
	 * @param {String} [affData]    The data from the dictionary's .aff file. If omitted
	 *                              and Typo.js is being used in a Chrome extension, the .aff
	 *                              file will be loaded automatically from
	 *                              lib/typo/dictionaries/[dictionary]/[dictionary].aff
	 *                              In other environments, it will be loaded from
	 *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].aff
	 * @param {String} [wordsData]  The data from the dictionary's .dic file. If omitted
	 *                              and Typo.js is being used in a Chrome extension, the .dic
	 *                              file will be loaded automatically from
	 *                              lib/typo/dictionaries/[dictionary]/[dictionary].dic
	 *                              In other environments, it will be loaded from
	 *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].dic
	 * @param {Object} [settings]   Loader settings. Available properties are:
	 *                              {String} [dictionaryPath]: path to load dictionary from in non-chrome
	 *                              environment.
	 *                              {Object} [flags]: flag information.
	 *                              {Boolean} [asyncLoad]: If true, affData and wordsData will be loaded
	 *                              asynchronously.
	 *                              {Function} [loadedCallback]: Called when both affData and wordsData
	 *                              have been loaded. Only used if asyncLoad is set to true. The parameter
	 *                              is the instantiated Typo object.
	 * 								{String} [charset]: The character set specified on the first line of the
	 * 								.aff file if specified.
	 */
	load : function(dictionary, affData, wordsData, settings) {

		settings = settings || {};

		this.flags = settings.flags || {};


		var self = this;

		var path;

		// Loop-control variables.
		var i, j, _len, _jlen;


		this.dictionary = dictionary;

		// If the data is preloaded, just setup the Typo object.
		if (affData && wordsData) {
			setup();
		}
		else {
			if (!affData) readDataFile(this._resolveFilePath(dictionary, 'aff', settings.dictionaryPath), setAffData);
			if (!wordsData) readDataFile(this._resolveFilePath(dictionary, 'dic', settings.dictionaryPath), setWordsData);
		}

		function readDataFile(url, setFunc) {
			var response = self._readFile(url, settings.charset, settings.asyncLoad);

			if (settings.asyncLoad) {
				response.then(function(data) {
					setFunc(data);
				});
			}
			else {
				setFunc(response);
			}
		}

		function setAffData(data) {
			affData = data;

			if (wordsData) {
				setup();
			}
		}

		function setWordsData(data) {
			wordsData = data;

			if (affData) {
				setup();
			}
		}

		function setup() {
			self._loadAff(affData);

			self.dictionaryTable = self._parseDIC(wordsData);

			self._loadFinish(settings);
		}

	},

	_resolveFilePath : function(dictionary, extension, dictionaryPath) {

		var path;

		// Loading data for Chrome extentions.
		if (typeof window !== 'undefined' && 'chrome' in window && 'extension' in window.chrome && 'getURL' in window.chrome.extension) {
			if (dictionaryPath) {
				path = dictionaryPath;
			}
			else {
				path = "src/dictionaries";
			}

			return chrome.extension.getURL(path + "/" + dictionary + "/" + dictionary + "." + extension);
		}
		else {
			if (dictionaryPath) {
				path = dictionaryPath;
			}
			else if (typeof __dirname !== 'undefined') {
				path = __dirname + '/dictionaries';
			}
			else {
				path = './dictionaries';
			}

			return path + "/" + dictionary + "/" + dictionary + "." + extension;
		}
	},

	// Loads the AFF From a string containing it
	_loadAff : function(data) {
		var i, j, _len, _jlen;

		this.rules = this._parseAFF(data);

		// Save the rule codes that are used in compound rules.
		this.compoundRuleCodes = {};

		for (i = 0, _len = this.compoundRules.length; i < _len; i++) {
			var rule = this.compoundRules[i];

			for (j = 0, _jlen = rule.length; j < _jlen; j++) {
				this.compoundRuleCodes[rule[j]] = [];
			}
		}

		// If we add this ONLYINCOMPOUND flag to self.compoundRuleCodes, then _parseDIC
		// will do the work of saving the list of words that are compound-only.
		if ("ONLYINCOMPOUND" in this.flags) {
			this.compoundRuleCodes[this.flags.ONLYINCOMPOUND] = [];
		}

	},


	// Perform any steps needing after both the DIC and the AFF are in
	_loadFinish : function (settings) {

		// Loop-control variables.
		var i, j, _len, _jlen;


		// Get rid of any codes from the compound rule codes that are never used
		// (or that were special regex characters).  Not especially necessary...
		for (i in this.compoundRuleCodes) {
			if (this.compoundRuleCodes[i].length === 0) {
				delete this.compoundRuleCodes[i];
			}
		}

		// Build the full regular expressions for each compound rule.
		// I have a feeling (but no confirmation yet) that this method of
		// testing for compound words is probably slow.
		for (i = 0, _len = this.compoundRules.length; i < _len; i++) {
			var ruleText = this.compoundRules[i];

			var expressionText = "";

			for (j = 0, _jlen = ruleText.length; j < _jlen; j++) {
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

		this.loaded = true;

		if (settings.asyncLoad && settings.loadedCallback) {
			settings.loadedCallback(this);
		}
	},

	_getDictionaryEntry : function(key) {
		return this.dictionaryTable[key];
	},

	/**
	 * Read the contents of a file.
	 *
	 * @param {String} path The path (relative) to the file.
	 * @param {String} [charset="ISO8859-1"] The expected charset of the file
	 * @param {Boolean} async If true, the file will be read asynchronously. For node.js this does nothing, all
	 *        files are read synchronously.
	 * @returns {String} The file data if async is false, otherwise a promise object. If running node.js, the data is
	 *          always returned.
	 */

	_readFile : function (path, charset, async, arrayBuffer) {
		// NOTE: Node 6.4.0+ is required for the default character sets
		charset = charset || "ISO8859-1";

		if (typeof XMLHttpRequest !== 'undefined') {
			var promise;
			var req = new XMLHttpRequest();
			req.open("GET", path, async);

			if (async) {
				promise = new Promise(function(resolve, reject) {
					req.onload = function() {
						if (req.status === 200) {
							resolve(arrayBuffer? req.response : req.responseText);
						}
						else {
							reject(req.statusText);
						}
					};

					req.onerror = function() {
						reject(req.statusText);
					}
				});
			}

			if (arrayBuffer) {
				req.responseType = "arraybuffer";
			}
			else if (req.overrideMimeType) {
				req.overrideMimeType("text/plain; charset=" + charset);
			}

			req.send(null);

			return async ? promise : (buffer? req.response : req.responseText);
		}
		else if (typeof require !== 'undefined') {
			// Node.js
			var fs = require("fs");

			// Some charsets go by another name for node buffer
			if(charset.toUpperCase() === 'ISO8859-1') {
				charset = 'latin1';
			}
			
			try {
				if (fs.existsSync(path)) {
					var stats = fs.statSync(path);

					var fileDescriptor = fs.openSync(path, 'r');

					var buffer = new Buffer(stats.size);

					fs.readSync(fileDescriptor, buffer, 0, buffer.length, null);

					var val;
					if(arrayBuffer) {
						val = buffer.buffer;
					}
					else {
						val = buffer.toString(charset, 0, buffer.length);;
					}

					return async? Promise.resolve(val) : val;
				}
				else {
					console.log("Path " + path + " does not exist.");
				}
			} catch (e) {
				console.log(e);
				return '';
			}
		}
	},

	/**
	 * Parse the rules out from a .aff file.
	 *
	 * @param {String} data The contents of the affix file.
	 * @returns object The rules from the file.
	 */

	_parseAFF : function (data) {
		var rules = {};

		var line, subline, numEntries, lineParts;
		var i, j, _len, _jlen;

		// Remove comment lines
		data = this._removeAffixComments(data);

		var lines = data.split("\n");

		for (i = 0, _len = lines.length; i < _len; i++) {
			line = lines[i];

			var definitionParts = line.split(/\s+/);

			var ruleType = definitionParts[0];

			if (ruleType == "PFX" || ruleType == "SFX") {
				var ruleCode = definitionParts[1];
				var combineable = definitionParts[2];
				numEntries = parseInt(definitionParts[3], 10);

				var entries = [];

				for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					subline = lines[j];

					lineParts = subline.split(/\s+/);
					var charactersToRemove = lineParts[2];

					var additionParts = lineParts[3].split("/");

					var charactersToAdd = additionParts[0];
					if (charactersToAdd === "0") charactersToAdd = "";

					var continuationClasses = this.parseRuleCodes(additionParts[1]);

					var regexToMatch = lineParts[4];

					var entry = {};
					entry.add = charactersToAdd;

					if (continuationClasses.length > 0) entry.continuationClasses = continuationClasses;

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
				numEntries = parseInt(definitionParts[1], 10);

				for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					line = lines[j];

					lineParts = line.split(/\s+/);
					this.compoundRules.push(lineParts[1]);
				}

				i += numEntries;
			}
			else if (ruleType === "REP") {
				lineParts = line.split(/\s+/);

				if (lineParts.length === 3) {
					this.replacementTable.push([ lineParts[1], lineParts[2] ]);
				}
			}
			else {
				// ONLYINCOMPOUND
				// COMPOUNDMIN
				// FLAG
				// KEEPCASE
				// NEEDAFFIX

				this.flags[ruleType] = definitionParts[1];
			}
		}

		return rules;
	},

	/**
	 * Removes comment lines and then cleans up blank lines and trailing whitespace.
	 *
	 * @param {String} data The data from an affix file.
	 * @return {String} The cleaned-up data.
	 */

	_removeAffixComments : function (data) {
		// Remove comments
		// This used to remove any string starting with '#' up to the end of the line,
		// but some COMPOUNDRULE definitions include '#' as part of the rule.
		// I haven't seen any affix files that use comments on the same line as real data,
		// so I don't think this will break anything.
		data = data.replace(/^\s*#.*$/mg, "");

		// Trim each line
		data = data.replace(/^\s\s*/m, '').replace(/\s\s*$/m, '');

		// Remove blank lines.
		data = data.replace(/\n{2,}/g, "\n");

		// Trim the entire string
		data = data.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

		return data;
	},

	/**
	 * Parses the words out from the .dic file.
	 *
	 * @param {String} data The data from the dictionary file.
	 * @returns object The lookup table containing all of the words and
	 *                 word forms from the dictionary.
	 */

	_parseDIC : function (data) {
		data = this._removeDicComments(data);

		var lines = data.split("\n");
		var dictionaryTable = {};

		function addWord(word, rules) {
			// Some dictionaries will list the same word multiple times with different rule sets.
			if (!dictionaryTable.hasOwnProperty(word)) {
				dictionaryTable[word] = null;
			}

			if (rules.length > 0) {
				if (dictionaryTable[word] === null) {
					dictionaryTable[word] = [];
				}

				dictionaryTable[word].push(rules);
			}
		}

		// The first line is the number of words in the dictionary.
		for (var i = 1, _len = lines.length; i < _len; i++) {
			var line = lines[i];

			if (!line) {
				// Ignore empty lines.
				continue;
			}

			var parts = line.split("/", 2);

			var word = parts[0];

			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodesArray = this.parseRuleCodes(parts[1]);

				// Save the ruleCodes for compound word situations.
				if (!("NEEDAFFIX" in this.flags) || ruleCodesArray.indexOf(this.flags.NEEDAFFIX) == -1) {
					addWord(word, ruleCodesArray);
				}

				for (var j = 0, _jlen = ruleCodesArray.length; j < _jlen; j++) {
					var code = ruleCodesArray[j];

					var rule = this.rules[code];

					if (rule) {
						var newWords = this._applyRule(word, rule);

						for (var ii = 0, _iilen = newWords.length; ii < _iilen; ii++) {
							var newWord = newWords[ii];

							addWord(newWord, []);

							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodesArray[k];

									var combineRule = this.rules[combineCode];

									if (combineRule) {
										if (combineRule.combineable && (rule.type != combineRule.type)) {
											var otherNewWords = this._applyRule(newWord, combineRule);

											for (var iii = 0, _iiilen = otherNewWords.length; iii < _iiilen; iii++) {
												var otherNewWord = otherNewWords[iii];
												addWord(otherNewWord, []);
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
				addWord(word.trim(), []);
			}
		}

		return dictionaryTable;
	},


	/**
	 * Removes comment lines and then cleans up blank lines and trailing whitespace.
	 *
	 * @param {String} data The data from a .dic file.
	 * @return {String} The cleaned-up data.
	 */

	_removeDicComments : function (data) {
		// I can't find any official documentation on it, but at least the de_DE
		// dictionary uses tab-indented lines as comments.

		// Remove comments
		data = data.replace(/^\t.*$/mg, "");

		return data;
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
				flags.push(textCodes.substr(i, 2));
			}

			return flags;
		}
		else if (this.flags.FLAG === "num") {
			return textCodes.split(",");
		}
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

				if ("continuationClasses" in entry) {
					for (var j = 0, _jlen = entry.continuationClasses.length; j < _jlen; j++) {
						var continuationRule = this.rules[entry.continuationClasses[j]];

						if (continuationRule) {
							newWords = newWords.concat(this._applyRule(newWord, continuationRule));
						}
						/*
						else {
							// This shouldn't happen, but it does, at least in the de_DE dictionary.
							// I think the author mistakenly supplied lower-case rule codes instead
							// of upper-case.
						}
						*/
					}
				}
			}
		}

		return newWords;
	},

	/**
	 * Checks whether a word or a capitalization variant exists in the current dictionary.
	 * The word is trimmed and several variations of capitalizations are checked.
	 * If you want to check a word without any changes made to it, call checkExact()
	 *
	 * @see http://blog.stevenlevithan.com/archives/faster-trim-javascript re:trimming function
	 *
	 * @param {String} aWord The word to check.
	 * @returns {Boolean}
	 */

	check : function (aWord) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		// Remove leading and trailing whitespace
		var trimmedWord = aWord.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

		if (this.checkExact(trimmedWord)) {
			return true;
		}

		// The exact word is not in the dictionary.
		if (trimmedWord.toUpperCase() === trimmedWord) {
			// The word was supplied in all uppercase.
			// Check for a capitalized form of the word.
			var capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();

			if (this.hasFlag(capitalizedWord, "KEEPCASE")) {
				// Capitalization variants are not allowed for this word.
				return false;
			}

			if (this.checkExact(capitalizedWord)) {
				return true;
			}
		}

		var lowercaseWord = trimmedWord.toLowerCase();

		if (lowercaseWord !== trimmedWord) {
			if (this.hasFlag(lowercaseWord, "KEEPCASE")) {
				// Capitalization variants are not allowed for this word.
				return false;
			}

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
	 * @param {String} word The word to check.
	 * @returns {Boolean}
	 */

	checkExact : function (word) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		var ruleCodes = this._getDictionaryEntry(word);

		var i, _len;

		if (typeof ruleCodes === 'undefined') {
			// Check if this might be a compound word.
			if ("COMPOUNDMIN" in this.flags && word.length >= this.flags.COMPOUNDMIN) {
				for (i = 0, _len = this.compoundRules.length; i < _len; i++) {
					if (word.match(this.compoundRules[i])) {
						return true;
					}
				}
			}
		}
		else if (ruleCodes === null) {
			// a null (but not undefined) value for an entry in the dictionary table
			// means that the word is in the dictionary but has no flags.
			return true;
		}
		else if (typeof ruleCodes === 'object') { // this.dictionary['hasOwnProperty'] will be a function.
			for (i = 0, _len = ruleCodes.length; i < _len; i++) {
				if (!this.hasFlag(word, "ONLYINCOMPOUND", ruleCodes[i])) {
					return true;
				}
			}
		}

		return false;
	},

	/**
	 * Looks up whether a given word is flagged with a given flag.
	 *
	 * @param {String} word The word in question.
	 * @param {String} flag The flag in question.
	 * @return {Boolean}
	 */

	hasFlag : function (word, flag, wordFlags) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		if (flag in this.flags) {
			if (typeof wordFlags === 'undefined') {
				wordFlags = Array.prototype.concat.apply([], this._getDictionaryEntry(word));
			}

			if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
				return true;
			}
		}

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
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		limit = limit || 5;

		if (this.memoized.hasOwnProperty(word)) {
			var memoizedLimit = this.memoized[word]['limit'];

			// Only return the cached list if it's big enough or if there weren't enough suggestions
			// to fill a smaller limit.
			if (limit <= memoizedLimit || this.memoized[word]['suggestions'].length < memoizedLimit) {
				return this.memoized[word]['suggestions'].slice(0, limit);
			}
		}

		if (this.check(word)) return [];

		// Check the replacement table.
		for (var i = 0, _len = this.replacementTable.length; i < _len; i++) {
			var replacementEntry = this.replacementTable[i];

			if (word.indexOf(replacementEntry[0]) !== -1) {
				var correctedWord = word.replace(replacementEntry[0], replacementEntry[1]);

				if (this.check(correctedWord)) {
					return [ correctedWord ];
				}
			}
		}

		var self = this;
		self.alphabet = "abcdefghijklmnopqrstuvwxyz";

		/*
		if (!self.alphabet) {
			// Use the alphabet as implicitly defined by the words in the dictionary.
			var alphaHash = {};

			for (var i in self.dictionaryTable) {
				for (var j = 0, _len = i.length; j < _len; j++) {
					alphaHash[i[j]] = true;
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

		/**
		 * Returns a hash keyed by all of the strings that can be made by making a single edit to the word (or words in) `words`
		 * The value of each entry is the number of unique ways that the resulting word can be made.
		 *
		 * @arg mixed words Either a hash keyed by words or a string word to operate on.
		 * @arg bool known_only Whether this function should ignore strings that are not in the dictionary.
		 */
		function edits1(words, known_only) {
			var rv = {};

			var i, j, _iilen, _len, _jlen, _edit;

			if (typeof words == 'string') {
				var word = words;
				words = {};
				words[word] = true;
			}

			for (var word in words) {
				for (i = 0, _len = word.length + 1; i < _len; i++) {
					var s = [ word.substring(0, i), word.substring(i) ];

					if (s[1]) {
						_edit = s[0] + s[1].substring(1);

						if (!known_only || self.check(_edit)) {
							if (!(_edit in rv)) {
								rv[_edit] = 1;
							}
							else {
								rv[_edit] += 1;
							}
						}
					}

					// Eliminate transpositions of identical letters
					if (s[1].length > 1 && s[1][1] !== s[1][0]) {
						_edit = s[0] + s[1][1] + s[1][0] + s[1].substring(2);

						if (!known_only || self.check(_edit)) {
							if (!(_edit in rv)) {
								rv[_edit] = 1;
							}
							else {
								rv[_edit] += 1;
							}
						}
					}

					if (s[1]) {
						for (j = 0, _jlen = self.alphabet.length; j < _jlen; j++) {
							// Eliminate replacement of a letter by itself
							if (self.alphabet[j] != s[1].substring(0,1)){
								_edit = s[0] + self.alphabet[j] + s[1].substring(1);

								if (!known_only || self.check(_edit)) {
									if (!(_edit in rv)) {
										rv[_edit] = 1;
									}
									else {
										rv[_edit] += 1;
									}
								}
							}
						}
					}

					if (s[1]) {
						for (j = 0, _jlen = self.alphabet.length; j < _jlen; j++) {
							_edit = s[0] + self.alphabet[j] + s[1];

							if (!known_only || self.check(_edit)) {
								if (!(_edit in rv)) {
									rv[_edit] = 1;
								}
								else {
									rv[_edit] += 1;
								}
							}
						}
					}
				}
			}

			return rv;
		}

		function correct(word) {
			// Get the edit-distance-1 and edit-distance-2 forms of this word.
			var ed1 = edits1(word);
			var ed2 = edits1(ed1, true);

			// Sort the edits based on how many different ways they were created.
			var weighted_corrections = ed2;

			for (var ed1word in ed1) {
				if (!self.check(ed1word)) {
					continue;
				}

				if (ed1word in weighted_corrections) {
					weighted_corrections[ed1word] += ed1[ed1word];
				}
				else {
					weighted_corrections[ed1word] = ed1[ed1word];
				}
			}

			var i, _len;

			var sorted_corrections = [];

			for (i in weighted_corrections) {
				if (weighted_corrections.hasOwnProperty(i)) {
					sorted_corrections.push([ i, weighted_corrections[i] ]);
				}
			}

			function sorter(a, b) {
				if (a[1] < b[1]) {
					return -1;
				}

				// @todo If a and b are equally weighted, add our own weight based on something like the key locations on this language's default keyboard.

				return 1;
			}

			sorted_corrections.sort(sorter).reverse();

			var rv = [];

			var capitalization_scheme = "lowercase";

			if (word.toUpperCase() === word) {
				capitalization_scheme = "uppercase";
			}
			else if (word.substr(0, 1).toUpperCase() + word.substr(1).toLowerCase() === word) {
				capitalization_scheme = "capitalized";
			}

			var working_limit = limit;

			for (i = 0; i < Math.min(working_limit, sorted_corrections.length); i++) {
				if ("uppercase" === capitalization_scheme) {
					sorted_corrections[i][0] = sorted_corrections[i][0].toUpperCase();
				}
				else if ("capitalized" === capitalization_scheme) {
					sorted_corrections[i][0] = sorted_corrections[i][0].substr(0, 1).toUpperCase() + sorted_corrections[i][0].substr(1);
				}

				if (!self.hasFlag(sorted_corrections[i][0], "NOSUGGEST") && rv.indexOf(sorted_corrections[i][0]) == -1) {
					rv.push(sorted_corrections[i][0]);
				}
				else {
					// If one of the corrections is not eligible as a suggestion , make sure we still return the right number of suggestions.
					working_limit++;
				}
			}

			return rv;
		}

		this.memoized[word] = {
			'suggestions': correct(word),
			'limit': limit
		};

		return this.memoized[word]['suggestions'];
	}
};
})();

// Support for use as a node.js module.
if (typeof module !== 'undefined') {
	module.exports = Typo;
}
