/*global chrome, XMLHttpRequest*/

/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style
 * dictionaries.
 */

/**
 * Typo constructor.
 *
 * @param {String} [dictionary] The locale code of the dictionary being used. e.g.,
 *                              "en_US". This is only used to auto-load dictionaries.
 * @param {String} [affData] The data from the dictionary's .aff file. If omitted
 *                           and the first argument is supplied, in "chrome" platform,
 *                           the .aff file will be loaded automatically from
 *                           lib/typo/dictionaries/[dictionary]/[dictionary].aff
 *                           In other platform, it will be loaded from
 *                           [setting.path]/dictionaries/[dictionary]/[dictionary].aff
 * @param {String} [wordsData] The data from the dictionary's .dic file. If omitted,
 *                           and the first argument is supplied, in "chrome" platform,
 *                           the .dic file will be loaded automatically from
 *                           lib/typo/dictionaries/[dictionary]/[dictionary].dic
 *                           In other platform, it will be loaded from
 *                           [setting.path]/dictionaries/[dictionary]/[dictionary].dic
 * @param {Object} [settings] Constructor settings. Available properties are:
 *                            {String} [platform]: "chrome" for Chrome Extension or other
 *                              value for the usual web.
 *                            {String} [path]: path to load dictionary from in non-chrome
 *                              environment.
 *                            {Object} [flags]: flag information.
 *
 *
 * @returns {Typo} A Typo object.
 */

var Typo = function (dictionary, affData, wordsData, settings) {
    "use strict";
    var path = settings.dictionaryPath || '',
        rule,
        code,
        ruleText,
        expressionText,
        character,
        i,
        j;

    settings = settings || {};

    /** Determines the method used for auto-loading .aff and .dic files. **/
    this.platform = settings.platform || "chrome";

    this.dictionary = null;

    this.rules = {};
    this.dictionaryTable = {};

    this.compoundRules = [];
    this.compoundRuleCodes = {};

    this.replacementTable = [];

    this.flags = settings.flags || {};

    if (dictionary) {
        this.dictionary = dictionary;

        if (this.platform === "chrome") {
            affData = affData || this.readFile(chrome.extension.getURL("lib/typo/dictionaries/" + dictionary + "/" + dictionary + ".aff"));
            wordsData = wordsData || this.readFile(chrome.extension.getURL("lib/typo/dictionaries/" + dictionary + "/" + dictionary + ".dic"));
        } else {
            affData = affData || this.readFile(path + "/" + dictionary + "/" + dictionary + ".aff");
            wordsData = wordsData || this.readFile(path + "/" + dictionary + "/" + dictionary + ".dic");
        }

        this.rules = this.parseAFF(affData);

        // Save the rule codes that are used in compound rules.
        this.compoundRuleCodes = {};

        for (i = 0; i < this.compoundRules.length; i += 1) {
            rule = this.compoundRules[i];

            for (j = 0; j < rule.length; j += 1) {
                this.compoundRuleCodes[rule[j]] = [];
            }
        }

        // If we add this ONLYINCOMPOUND flag to this.compoundRuleCodes, then _parseDIC
        // will do the work of saving the list of words that are compound-only.
        if (this.flags.hasOwnProperty("ONLYINCOMPOUND")) {
            this.compoundRuleCodes[this.flags.ONLYINCOMPOUND] = [];
        }

        this.dictionaryTable = this.parseDIC(wordsData);

        // Get rid of any codes from the compound rule codes that are never used
        // (or that were special regex characters).  Not especially necessary...
        for (code in this.compoundRuleCodes) {
            if (this.compoundRuleCodes.hasOwnProperty(code)) {
                if (this.compoundRuleCodes[code].length === 0) {
                    delete this.compoundRuleCodes[code];
                }
            }
        }

        // Build the full regular expressions for each compound rule.
        // I have a feeling (but no confirmation yet) that this method of
        // testing for compound words is probably slow.
        for (i = 0; i < this.compoundRules.length; i += 1) {
            ruleText = this.compoundRules[i];
            expressionText = "";

            for (j = 0; j < ruleText.length; j += 1) {
                character = ruleText[j];

                if (this.compoundRuleCodes.hasOwnProperty(character)) {
                    expressionText += "(" + this.compoundRuleCodes[character].join("|") + ")";
                } else {
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
        "use strict";
        var i;

        for (i in obj) {
            if (obj.hasOwnProperty(i)) {
                this[i] = obj[i];
            }
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

    readFile : function (path, charset) {
        "use strict";
        var req = new XMLHttpRequest();

        req.open("GET", path, false);

        if (req.overrideMimeType) {
            req.overrideMimeType("text/plain; charset=" + charset || "ISO8859-1");
        }

        req.send(null);

        return req.responseText;
    },

    /**
     * Parse the rules out from a .aff file.
     *
     * @param {String} data The contents of the affix file.
     * @returns object The rules from the file.
     */

    parseAFF : function (data) {
        "use strict";
        var rules = {},
            lines,
            line,
            definitionParts,
            ruleType,
            ruleCode,
            combineable,
            numEntries,
            entries,
            lineParts,
            charactersToRemove,
            additionParts,
            charactersToAdd,
            continuationClasses,
            regexToMatch,
            entry,
            i,
            j;

        // Remove comment lines
        data = this.removeAffixComments(data);

        lines = data.split("\n");

        for (i = 0; i < lines.length; i += 1) {
            line = lines[i];

            definitionParts = line.split(/\s+/);

            ruleType = definitionParts[0];

            if (ruleType === "PFX" || ruleType === "SFX") {
                ruleCode = definitionParts[1];
                combineable = definitionParts[2];
                numEntries = parseInt(definitionParts[3], 10);

                entries = [];

                for (j = i + 1; j < i + 1 + numEntries; j += 1) {
                    line = lines[j];

                    lineParts = line.split(/\s+/);
                    charactersToRemove = lineParts[2];

                    additionParts = lineParts[3].split("/");

                    charactersToAdd = additionParts[0];

                    if (charactersToAdd === "0") {
                        charactersToAdd = "";
                    }

                    continuationClasses = this.parseRuleCodes(additionParts[1]);

                    regexToMatch = lineParts[4];

                    entry = {"add": charactersToAdd};

                    if (continuationClasses.length > 0) {
                        entry.continuationClasses = continuationClasses;
                    }

                    if (regexToMatch !== ".") {
                        if (ruleType === "SFX") {
                            entry.match = new RegExp(regexToMatch + "$");
                        } else {
                            entry.match = new RegExp("^" + regexToMatch);
                        }
                    }

                    if (charactersToRemove !== "0") {
                        if (ruleType === "SFX") {
                            entry.remove = new RegExp(charactersToRemove  + "$");
                        } else {
                            entry.remove = charactersToRemove;
                        }
                    }

                    entries.push(entry);
                }

                rules[ruleCode] = {
                    "type" : ruleType,
                    "combineable" : combineable === "Y",
                    "entries" : entries
                };

                i += numEntries;
            } else if (ruleType === "COMPOUNDRULE") {
                numEntries = parseInt(definitionParts[1], 10);

                for (j = i + 1; j < i + 1 + numEntries; j += 1) {
                    line = lines[j];

                    lineParts = line.split(/\s+/);
                    this.compoundRules.push(lineParts[1]);
                }

                i += numEntries;
            } else if (ruleType === "REP") {
                lineParts = line.split(/\s+/);

                if (lineParts.length === 3) {
                    this.replacementTable.push([ lineParts[1], lineParts[2] ]);
                }
            } else {
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

    removeAffixComments : function (data) {
        "use strict";
        // Remove comments
        data = data.replace(/#.*$/mg, "");

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

    parseDIC : function (data) {
        "use strict";
        var lines,
            dictionaryTable,
            line,
            parts,
            word,
            ruleCodesArray,
            code,
            rule,
            newWords,
            newWord,
            combineCode,
            combineRule,
            otherNewWord,
            otherNewWords,
            i,
            j,
            k,
            l,
            m;

        data = this.removeDicComments(data);

        lines = data.split("\n");
        dictionaryTable = {};

        function addWord(word, rules) {
            // Some dictionaries will list the same word multiple times with different rule sets.
            if (!(dictionaryTable.hasOwnProperty(word)) || typeof dictionaryTable[word] !== 'object') {
                dictionaryTable[word] = [];
            }

            dictionaryTable[word].push(rules);
        }

        // The first line is the number of words in the dictionary.
        for (i = 1; i < lines.length; i += 1) {
            line = lines[i];

            parts = line.split("/", 2);

            word = parts[0];

            // Now for each affix rule, generate that form of the word.
            if (parts.length > 1) {
                ruleCodesArray = this.parseRuleCodes(parts[1]);

                // Save the ruleCodes for compound word situations.
                if (!(this.flags.hasOwnProperty("NEEDAFFIX")) || ruleCodesArray.indexOf(this.flags.NEEDAFFIX) === -1) {
                    addWord(word, ruleCodesArray);
                }

                for (j = 0; j < ruleCodesArray.length; j += 1) {
                    code = ruleCodesArray[j];

                    rule = this.rules[code];

                    if (rule) {
                        newWords = this.applyRule(word, rule);

                        for (k = 0; k < newWords.length; k += 1) {
                            newWord = newWords[k];

                            addWord(newWord, []);

                            if (rule.combineable) {
                                for (l = j + 1; l < ruleCodesArray.length; l += 1) {
                                    combineCode = ruleCodesArray[l];

                                    combineRule = this.rules[combineCode];

                                    if (combineRule) {
                                        if (combineRule.combineable && (rule.type !== combineRule.type)) {
                                            otherNewWords = this.applyRule(newWord, combineRule);

                                            for (m = 0; m < otherNewWords.length; m += 1) {
                                                otherNewWord = otherNewWords[m];
                                                addWord(otherNewWord, []);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (this.compoundRuleCodes.hasOwnProperty(code)) {
                        this.compoundRuleCodes[code].push(word);
                    }
                }
            } else {
                addWord(word, []);
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

    removeDicComments : function (data) {
        "use strict";
        // I can't find any official documentation on it, but at least the de_DE
        // dictionary uses tab-indented lines as comments.

        // Remove comments
        data = data.replace(/^\t.*$/mg, "");

        // Trim each line
        data = data.replace(/^\s\s*/m, '').replace(/\s\s*$/m, '');

        // Remove blank lines.
        data = data.replace(/\n{2,}/g, "\n");

        // Trim the entire string
        data = data.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

        return data;
    },

    parseRuleCodes : function (textCodes) {
        "use strict";

        var flags = [],
            i;

        if (!textCodes) {
            return [];
        }

        if (!(this.flags.hasOwnProperty("FLAG"))) {
            return textCodes.split("");
        }

        if (this.flags.FLAG === "long") {

            for (i = 0; i < textCodes.length; i += 2) {
                flags.push(textCodes.substr(i, 2));
            }

            return flags;
        }

        if (this.flags.FLAG === "num") {
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

    applyRule : function (word, rule) {
        "use strict";
        var entries = rule.entries,
            newWords = [],
            entry,
            newWord,
            continuationRule,
            i,
            j;

        for (i = 0; i < entries.length; i += 1) {
            entry = entries[i];

            if (!entry.match || word.match(entry.match)) {
                newWord = word;

                if (entry.remove) {
                    newWord = newWord.replace(entry.remove, "");
                }

                if (rule.type === "SFX") {
                    newWord = newWord + entry.add;
                } else {
                    newWord = entry.add + newWord;
                }

                newWords.push(newWord);

                if (entry.hasOwnProperty("continuationClasses")) {
                    for (j = 0; j < entry.continuationClasses.length; j += 1) {
                        continuationRule = this.rules[entry.continuationClasses[j]];

                        if (continuationRule) {
                            newWords = newWords.concat(this.applyRule(newWord, continuationRule));
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
        "use strict";
        // Remove leading and trailing whitespace
        var trimmedWord = aWord.replace(/^\s\s*/, '').replace(/\s\s*$/, ''),
            capitalizedWord,
            lowercaseWord;

        if (typeof this.dictionaryTable[trimmedWord] === "function") {
            return false;
        }

        if (this.checkExact(trimmedWord)) {
            return true;
        }

        // The exact word is not in the dictionary.
        if (trimmedWord.toUpperCase() === trimmedWord) {
            // The word was supplied in all uppercase.
            // Check for a capitalized form of the word.
            capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();

            if (this.hasFlag(capitalizedWord, "KEEPCASE")) {
                // Capitalization variants are not allowed for this word.
                return false;
            }

            if (this.checkExact(capitalizedWord)) {
                return true;
            }
        }

        lowercaseWord = trimmedWord.toLowerCase();

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
        "use strict";
        var ruleCodes = this.dictionaryTable[word],
            i;

        if (ruleCodes === undefined) {
            // Check if this might be a compound word.
            if ((this.flags.hasOwnProperty("COMPOUNDMIN")) && (word.length >= this.flags.COMPOUNDMIN)) {
                for (i = 0; i < this.compoundRules.length; i += 1) {
                    if (word.match(this.compoundRules[i])) {
                        return true;
                    }
                }
            }

            return false;
        }

        for (i = 0; i < ruleCodes.length; i += 1) {
            if (!this.hasFlag(word, "ONLYINCOMPOUND", ruleCodes[i])) {
                return true;
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
        "use strict";

        if (this.flags.hasOwnProperty(flag)) {

            wordFlags = wordFlags || Array.prototype.concat.apply([], this.dictionaryTable[word]);

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
        "use strict";

        var self = this,
            replacementEntry,
            correctedWord,
            i;

        limit = limit || 5;

        if (this.check(word)) {
            return [];
        }

        // Check the replacement table.
        for (i = 0; i < this.replacementTable.length; i += 1) {
            replacementEntry = this.replacementTable[i];

            if (word.indexOf(replacementEntry[0]) !== -1) {
                correctedWord = word.replace(replacementEntry[0], replacementEntry[1]);

                if (this.check(correctedWord)) {
                    return [ correctedWord ];
                }
            }
        }

        self.alphabet = "abcdefghijklmnopqrstuvwxyz";

        function edits1(words) {
            var rv = [],
                word,
                splits,
                deletes,
                transposes,
                replaces,
                inserts,
                i,
                j,
                k,
                s;

            for (i = 0; i < words.length; i += 1) {
                word = words[i];

                splits = [];

                for (j = 0; j < word.length + 1; j += 1) {
                    splits.push([ word.substring(0, j), word.substring(j, word.length) ]);
                }

                deletes = [];

                for (j = 0; j < splits.length; j += 1) {
                    s = splits[j];

                    if (s[1]) {
                        deletes.push(s[0] + s[1].substring(1));
                    }
                }

                transposes = [];

                for (j = 0; j < splits.length; j += 1) {
                    s = splits[j];

                    if (s[1].length > 1) {
                        transposes.push(s[0] + s[1][1] + s[1][0] + s[1].substring(2));
                    }
                }

                replaces = [];

                for (j = 0; j < splits.length; j += 1) {
                    s = splits[j];

                    if (s[1]) {
                        for (k = 0; k < self.alphabet.length; k += 1) {
                            replaces.push(s[0] + self.alphabet[k] + s[1].substring(1));
                        }
                    }
                }

                inserts = [];

                for (j = 0; j < splits.length; j += 1) {
                    s = splits[j];

                    if (s[1]) {
                        for (k = 0; k < self.alphabet.length; k += 1) {
                            replaces.push(s[0] + self.alphabet[k] + s[1]);
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
            var rv = [],
                i;

            for (i = 0; i < words.length; i += 1) {
                if (self.check(words[i])) {
                    rv.push(words[i]);
                }
            }

            return rv;
        }

        function correct(word) {
            // Get the edit-distance-1 and edit-distance-2 forms of this word.
            var ed1 = edits1([word]),
                ed2 = edits1(ed1),
                corrections = known(ed1).concat(known(ed2)),
                weighted_corrections = {}, // Sort the edits based on how many different ways they were created.
                sorted_corrections = [],
                rv = [],
                i;

            for (i = 0; i < corrections.length; i += 1) {
                if (!(weighted_corrections.hasOwnProperty(corrections[i]))) {
                    weighted_corrections[corrections[i]] = 1;
                } else {
                    weighted_corrections[corrections[i]] += 1;
                }
            }

            sorted_corrections = [];

            for (i in weighted_corrections) {
                if (weighted_corrections.hasOwnProperty(i)) {
                    sorted_corrections.push([ i, weighted_corrections[i] ]);
                }
            }

            function sorter(a, b) {
                if (a[1] < b[1]) {
                    return -1;
                }

                return 1;
            }

            sorted_corrections.sort(sorter).reverse();

            rv = [];

            for (i = 0; i < Math.min(limit, sorted_corrections.length); i += 1) {
                if (!self.hasFlag(sorted_corrections[i][0], "NOSUGGEST")) {
                    rv.push(sorted_corrections[i][0]);
                }
            }

            return rv;
        }

        return correct(word);
    }
};
