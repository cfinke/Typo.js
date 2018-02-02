/**
 * Typo is a Typescript port of a spellchecker using hunspell-style
 * dictionaries.
 */
interface IEntry {
    add?: string;
    continuationClasses?: any;
    match?: any;
    remove?: any;
}

export class Typo {
    private static DEFAULT_PATH = "dictionaries";

    private rules: { [rule: string]: any } = {};
    private dictionaryTable: { [word: string]: string[] } = {};

    private compoundRules: any[] = [];
    private compoundRuleCodes: { [rule: string]: string[] } = {};
    private replacementTable: any[] = [];
    private flags: { [flag: string]: any } = {};
    private memoized: { [rule: string]: any } = {};

    /**
     * Typo constructor.
     *
     * @param {String} [affData]    The data from the dictionary's .aff file.
     * @param {String} [wordsData]  The data from the dictionary's .dic file.
     *
     */
    constructor(
        private affData: string,
        private wordsData: string,
    ) {
        this.setup();
    }

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

    public check(aWord) {
        // Remove leading and trailing whitespace
        const trimmedWord = aWord.replace(/^\s\s*/, "").replace(/\s\s*$/, "");

        if (this.checkExact(trimmedWord)) {
        return true;
    }

    // The exact word is not in the dictionary.
        if (trimmedWord.toUpperCase() === trimmedWord) {
        // The word was supplied in all uppercase.
        // Check for a capitalized form of the word.
        const capitalizedWord =
            trimmedWord[0] + trimmedWord.substring(1).toLowerCase();

        if (this.hasFlag(capitalizedWord, "KEEPCASE")) {
            // Capitalization variants are not allowed for this word.
            return false;
        }

        if (this.checkExact(capitalizedWord)) {
            return true;
        }
    }

        const lowercaseWord = trimmedWord.toLowerCase();

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
    }

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

    public suggest(word: string, limit: number): string[] {
        limit = limit || 5;

        if (this.memoized.hasOwnProperty(word)) {
            const memoizedLimit = this.memoized[word].limit;

            // Only return the cached list if it's big enough or if there weren't enough suggestions
            // to fill a smaller limit.
            if (
                limit <= memoizedLimit ||
                this.memoized[word].suggestions.length < memoizedLimit
            ) {
                return this.memoized[word].suggestions.slice(0, limit);
            }
        }

        if (this.check(word)) { return []; }

        // Check the replacement table.
        for (let i = 0, len = this.replacementTable.length; i < len; i++) {
            const replacementEntry = this.replacementTable[i];

            if (word.indexOf(replacementEntry[0]) !== -1) {
                const correctedWord = word.replace(
                    replacementEntry[0],
                    replacementEntry[1],
                );

                if (this.check(correctedWord)) {
                    return [correctedWord];
                }
            }
        }

        /**
         * Returns a hash keyed by all of the strings that can be made by
         * making a single edit to the word (or words in) `words`
         * The value of each entry is the number of unique ways that the resulting word can be made.
         *
         * @arg mixed words Either a hash keyed by words or a string word to operate on.
         * @arg bool knownOnly Whether this function should ignore strings that are not in the dictionary.
         */
        function edits1(words, knownOnly?) {
            const rv = {};

            let i;
            let j;
            let len;
            let jlen;
            let edit;

            if (typeof words === "string") {
                const word = words;
                words = {};
                words[word] = true;
            }

            for (const word of words) {
                for (i = 0, len = word.length + 1; i < len; i++) {
                    const s = [word.substring(0, i), word.substring(i)];

                    if (s[1]) {
                        edit = s[0] + s[1].substring(1);

                        if (!knownOnly || this.check(edit)) {
                            if (!(edit in rv)) {
                                rv[edit] = 1;
                            } else {
                                rv[edit] += 1;
                            }
                        }
                    }

                    // Eliminate transpositions of identical letters
                    if (s[1].length > 1 && s[1][1] !== s[1][0]) {
                        edit = s[0] + s[1][1] + s[1][0] + s[1].substring(2);

                        if (!knownOnly || this.check(edit)) {
                            if (!(edit in rv)) {
                                rv[edit] = 1;
                            } else {
                                rv[edit] += 1;
                            }
                        }
                    }

                    if (s[1]) {
                        for (
                            j = 0, jlen = this.alphabet.length;
                        j < jlen;
                        j++
                        ) {
                            // Eliminate replacement of a letter by itthis
                            if (this.alphabet[j] !== s[1].substring(0, 1)) {
                                edit =
                                    s[0] + this.alphabet[j] + s[1].substring(1);

                                if (!knownOnly || this.check(edit)) {
                                    if (!(edit in rv)) {
                                        rv[edit] = 1;
                                    } else {
                                        rv[edit] += 1;
                                    }
                                }
                            }
                        }
                    }

                    if (s[1]) {
                        for (
                            j = 0, jlen = this.alphabet.length;
                        j < jlen;
                        j++
                        ) {
                            edit = s[0] + this.alphabet[j] + s[1];

                            if (!knownOnly || this.check(edit)) {
                                if (!(edit in rv)) {
                                    rv[edit] = 1;
                                } else {
                                    rv[edit] += 1;
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
            const ed1 = edits1(word);
            const ed2 = edits1(ed1, true);

            // Sort the edits based on how many different ways they were created.
            const weightedCorrections = ed2;

            for (const ed1word in ed1) {
                if (!this.check(ed1word)) {
                    continue;
                }

                if (ed1word in weightedCorrections) {
                    weightedCorrections[ed1word] += ed1[ed1word];
                } else {
                    weightedCorrections[ed1word] = ed1[ed1word];
                }
            }

            const sortedCorrections = [];

            for (const i in weightedCorrections) {
                if (weightedCorrections.hasOwnProperty(i)) {
                    sortedCorrections.push([i, weightedCorrections[i]]);
                }
            }

            function sorter(a: number[], b: number[]) {
                if (a[1] < b[1]) {
                    return -1;
                }

                // @todo If a and b are equally weighted, add our own weight based on something
                // like the key locations on this language's default keyboard.

                return 1;
            }

            sortedCorrections.sort(sorter).reverse();

            const rv = [];

            let capitalizationScheme = "lowercase";

            if (word.toUpperCase() === word) {
                capitalizationScheme = "uppercase";
            } else if (
                word.substr(0, 1).toUpperCase() +
                word.substr(1).toLowerCase() ===
            word
            ) {
                capitalizationScheme = "capitalized";
            }

            let workingLimit: number = limit;

            for (
                let i = 0;
            i < Math.min(workingLimit, sortedCorrections.length);
            i++
            ) {
                if ("uppercase" === capitalizationScheme) {
                    sortedCorrections[i][0] = sortedCorrections[
                        i
                    ][0].toUpperCase();
                } else if ("capitalized" === capitalizationScheme) {
                    sortedCorrections[i][0] =
                        sortedCorrections[i][0].substr(0, 1).toUpperCase() +
                        sortedCorrections[i][0].substr(1);
                }

                if (
                    !this.hasFlag(sortedCorrections[i][0], "NOSUGGEST") &&
                    rv.indexOf(sortedCorrections[i][0]) === -1
                ) {
                    rv.push(sortedCorrections[i][0]);
                } else {
                    // If one of the corrections is not eligible as a suggestion
                    // make sure we still return the right number of suggestions.
                    workingLimit++;
                }
            }

            return rv;
        }

        this.memoized[word] = {
            limit,
            suggestions: correct(word),
        };

        return this.memoized[word].suggestions;
    }
    private setup(): void {
        this.rules = this.parseAFF(this.affData);

        // Save the rule codes that are used in compound rules.
        this.compoundRuleCodes = {};

        this.compoundRules.forEach((rule) => {
            rule.forEach((item) => this.compoundRuleCodes[item] = []);
        });

        // If we add this ONLYINCOMPOUND flag to this.compoundRuleCodes, then _parseDIC
        // will do the work of saving the list of words that are compound-only.
        if ("ONLYINCOMPOUND" in this.flags) {
            this.compoundRuleCodes.ONLYINCOMPOUND = [];
        }

        this.dictionaryTable = this.parseDIC(this.wordsData);

        // Get rid of any codes from the compound rule codes that are never used
        // (or that were special regex characters).  Not especially necessary...
        for (const i in this.compoundRuleCodes) {
            if (this.compoundRuleCodes[i].length === 0) {
                delete this.compoundRuleCodes[i];
            }
        }

        // Build the full regular expressions for each compound rule.
        // I have a feeling (but no confirmation yet) that this method of
        // testing for compound words is probably slow.
        this.compoundRules.map((ruleText) => {

            let expressionText = "";

            ruleText.forEach((character) => {
                expressionText += character in this.compoundRuleCodes
                    ? "(" + this.compoundRuleCodes[character].join("|") + ")"
                    : character;
            });
            return new RegExp(expressionText, "i");
        });

    }

    /**
     * Parse the rules out from a .aff file.
     *
     * @param {String} data The contents of the affix file.
     * @returns object The rules from the file.
     */

    private parseAFF(data: string) {
        const rules = {};

        let line;
        let subline;
        let numEntries;
        let lineParts;
        let i;
        let j;
        let len;
        let jlen;

        // Remove comment lines
        data = this.removeAffixComments(data);

        const lines = data.split("\n");

        for (i = 0, len = lines.length; i < len; i++) {
            line = lines[i];

            const definitionParts = line.split(/\s+/);

            const ruleType = definitionParts[0];

            if (ruleType === "PFX" || ruleType === "SFX") {
                const ruleCode = definitionParts[1];
                const combineable = definitionParts[2];
                numEntries = parseInt(definitionParts[3], 10);

                const entries = [];

                for (j = i + 1, jlen = i + 1 + numEntries; j < jlen; j++) {
                    subline = lines[j];

                    lineParts = subline.split(/\s+/);
                    const charactersToRemove = lineParts[2];

                    const additionParts = lineParts[3].split("/");

                    let charactersToAdd = additionParts[0];
                    if (charactersToAdd === "0") { charactersToAdd = ""; }

                    const continuationClasses = this.parseRuleCodes(
                        additionParts[1],
                    );

                    const regexToMatch = lineParts[4];

                    const entry: IEntry = {};
                    entry.add = charactersToAdd;

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
                            entry.remove = new RegExp(charactersToRemove + "$");
                        } else {
                            entry.remove = charactersToRemove;
                        }
                    }

                    entries.push(entry);
                }

                rules[ruleCode] = {
                    combineable: combineable === "Y",
                    entries,
                    type: ruleType,
                };

                i += numEntries;
            } else if (ruleType === "COMPOUNDRULE") {
                numEntries = parseInt(definitionParts[1], 10);

                for (j = i + 1, jlen = i + 1 + numEntries; j < jlen; j++) {
                    line = lines[j];

                    lineParts = line.split(/\s+/);
                    this.compoundRules.push(lineParts[1]);
                }

                i += numEntries;
            } else if (ruleType === "REP") {
                lineParts = line.split(/\s+/);

                if (lineParts.length === 3) {
                    this.replacementTable.push([lineParts[1], lineParts[2]]);
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
    }

    /**
     * Removes comment lines and then cleans up blank lines and trailing whitespace.
     *
     * @param {String} data The data from an affix file.
     * @return {String} The cleaned-up data.
     */

    private removeAffixComments(data: string) {
        // Remove comments
        // This used to remove any string starting with '#' up to the end of the line,
        // but some COMPOUNDRULE definitions include '#' as part of the rule.
        // I haven't seen any affix files that use comments on the same line as real data,
        // so I don't think this will break anything.
        return data.replace(/^\s*#.*$/gm, "")
        // Trim each line
        .replace(/^\s\s*/m, "").replace(/\s\s*$/m, "")
    // Remove blank lines.
    .replace(/\n{2,}/g, "\n")
    // Trim the entire string
    .replace(/^\s\s*/, "").replace(/\s\s*$/, "");
    }

    /**
     * Parses the words out from the .dic file.
     *
     * @param {String} data The data from the dictionary file.
     * @returns object The lookup table containing all of the words and
     *                 word forms from the dictionary.
     */

    private parseDIC(data: string) {
        data = this.removeDicComments(data);

        const lines = data.split("\n");
        const dictionaryTable = {};

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
        for (let i = 1, len = lines.length; i < len; i++) {
            const line = lines[i];

            if (!line) {
                // Ignore empty lines.
                continue;
            }

            const parts = line.split("/", 2);

            const word = parts[0];

            // Now for each affix rule, generate that form of the word.
            if (parts.length > 1) {
                const ruleCodesArray = this.parseRuleCodes(parts[1]);

                // Save the ruleCodes for compound word situations.
                if (
                    !("NEEDAFFIX" in this.flags) ||
                    ruleCodesArray.indexOf(this.flags.NEEDAFFIX) === -1
                ) {
                    addWord(word, ruleCodesArray);
                }

                for (let j = 0, jlen = ruleCodesArray.length; j < jlen; j++) {
                    const code = ruleCodesArray[j];

                    const rule = this.rules[code];

                    if (rule) {
                        const newWords = this._applyRule(word, rule);

                        for (
                            let ii = 0, iilen = newWords.length;
                        ii < iilen;
                        ii++
                        ) {
                            const newWord = newWords[ii];

                            addWord(newWord, []);

                            if (rule.combineable) {
                                for (let k = j + 1; k < jlen; k++) {
                                    const combineCode = ruleCodesArray[k];

                                    const combineRule = this.rules[combineCode];

                                    if (combineRule) {
                                        if (
                                            combineRule.combineable &&
                                            rule.type !== combineRule.type
                                        ) {
                                            const otherNewWords = this._applyRule(
                                                newWord,
                                                combineRule,
                                            );

                                            for (
                                                let iii = 0,
                                                iiilen =
                                            otherNewWords.length;
                                            iii < iiilen;
                                            iii++
                                            ) {
                                                const otherNewWord =
                                                    otherNewWords[iii];
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
            } else {
                addWord(word.trim(), []);
            }
        }

        return dictionaryTable;
    }

    /**
     * Removes comment lines and then cleans up blank lines and trailing whitespace.
     *
     * @param {String} data The data from a .dic file.
     * @return {String} The cleaned-up data.
     */

    private removeDicComments(data) {
        // I can't find any official documentation on it, but at least the de_DE
        // dictionary uses tab-indented lines as comments.

        // Remove comments
        return data.replace(/^\t.*$/gm, "");
    }

    private parseRuleCodes(textCodes) {
        if (textCodes == null) {
            return [];
        } else if (!("FLAG" in this.flags)) {
            return textCodes.split("");
        } else if (this.flags.FLAG === "long") {
            const flags = [];

            for (let i = 0; i < textCodes.length; i += 2) {
                flags.push(textCodes.substr(i, 2));
            }

            return flags;
        } else if (this.flags.FLAG === "num") {
            return textCodes.split(",");
        }
    }

    /**
     * Applies an affix rule to a word.
     *
     * @param {String} word The base word.
     * @param {Object} rule The affix rule.
     * @returns {String[]} The new words generated by the rule.
     */

    private _applyRule(word, rule) {
        const entries = rule.entries;
        let newWords = [];

        for (let i = 0, len = entries.length; i < len; i++) {
            const entry = entries[i];

            if (!entry.match || word.match(entry.match)) {
                let newWord = word;

                if (entry.remove) {
                    newWord = newWord.replace(entry.remove, "");
                }

                if (rule.type === "SFX") {
                    newWord = newWord + entry.add;
                } else {
                    newWord = entry.add + newWord;
                }

                newWords.push(newWord);

                if ("continuationClasses" in entry) {
                    for (
                        let j = 0, jlen = entry.continuationClasses.length;
                    j < jlen;
                    j++
                    ) {
                        const continuationRule = this.rules[
                            entry.continuationClasses[j]
                        ];

                        if (continuationRule) {
                            newWords = newWords.concat(
                                this._applyRule(newWord, continuationRule),
                            );
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
    }

    /**
     * Checks whether a word exists in the current dictionary.
     *
     * @param {String} word The word to check.
     * @returns {Boolean}
     */

    private checkExact(word) {
        const ruleCodes = this.dictionaryTable[word];

        let i;
        let len;

        if (typeof ruleCodes === "undefined") {
            // Check if this might be a compound word.
            if (
                "COMPOUNDMIN" in this.flags &&
                word.length >= this.flags.COMPOUNDMIN
            ) {
                for (i = 0, len = this.compoundRules.length; i < len; i++) {
                    if (word.match(this.compoundRules[i])) {
                        return true;
                    }
                }
            }
        } else if (ruleCodes === null) {
            // a null (but not undefined) value for an entry in the dictionary table
            // means that the word is in the dictionary but has no flags.
            return true;
        } else if (typeof ruleCodes === "object") {
            // this.dictionary['hasOwnProperty'] will be a function.
            for (i = 0, len = ruleCodes.length; i < len; i++) {
                if (!this.hasFlag(word, "ONLYINCOMPOUND", ruleCodes[i])) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Looks up whether a given word is flagged with a given flag.
     *
     * @param {String} word The word in question.
     * @param {String} flag The flag in question.
     * @return {Boolean}
     */

    private hasFlag(word, flag, wordFlags?) {
        if (flag in this.flags) {
            if (typeof wordFlags === "undefined") {
                wordFlags = this.dictionaryTable[word];
            }

            if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
                return true;
            }
        }
        return false;
    }
}
