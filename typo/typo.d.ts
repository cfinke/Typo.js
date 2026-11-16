/**
 * Typo.js — a Hunspell-style spellchecker written in TypeScript.
 *
 * Typo reads Hunspell .aff and .dic dictionary files and checks words against them
 * (`check()`, `checkExact()`), and suggests corrections for misspellings (`suggest()`).
 *
 * Internally, words are never pre-expanded into every affixed form. The .dic file
 * is stored as a map from stem to its flag strings, and affixes are stripped from
 * a word at lookup time, which keeps memory use proportional to the size of the
 * dictionary file.
 */
/** Options accepted by the constructor. */
interface TypoSettings {
    /**
     * Directory that holds one sub-directory per dictionary, e.g. "typo/dictionaries"
     * holding "typo/dictionaries/en_US/en_US.aff" and ".dic".
     *
     * Wherever a global `window` exists, this defaults to "typo/dictionaries": relative to
     * the page, to the extension root in a browser extension, or to the working directory in
     * Node.js when something like jsdom defines `window` there. Otherwise, in Node.js it
     * defaults to the "dictionaries" directory next to the Typo module, and anywhere else (a
     * web worker or a service worker) to "./dictionaries", so pass the path explicitly there.
     */
    dictionaryPath?: string;
    /** Initial affix-file directives, keyed by directive name (e.g. { NOSUGGEST: "!" }). */
    flags?: Record<string, string>;
    /**
     * Load and parse the dictionary asynchronously. Parsing is time-sliced through
     * requestIdleCallback where available so that it does not block the UI.
     */
    asyncLoad?: boolean;
    /** Called with the Typo instance once an asynchronous load has finished. */
    loadedCallback?: (dictionary: Typo) => void;
    /**
     * Called if an asynchronous load fails, and also with anything that loadedCallback
     * throws. Defaults to logging the error.
     */
    errorCallback?: (error: unknown) => void;
}
type AffixType = "PFX" | "SFX";
/** One line of a PFX or SFX rule. */
interface AffixEntry {
    /** The rule's flag (its code in the .aff file). */
    readonly flag: string;
    readonly type: AffixType;
    /** Whether this rule may be combined with an affix of the other type (the Y/N column). */
    readonly crossProduct: boolean;
    /** Text removed from the stem before the affix is added ("" when the column is 0). */
    readonly strip: string;
    /** Text added to the stem ("" when the column is 0). */
    readonly add: string;
    /** Condition the stem has to meet, compiled to an anchored regular expression; null for ".". */
    readonly condition: RegExp | null;
    /** Flags that the affixed form carries on (the part after the "/" in the add column). */
    readonly continuation: string;
}
/** A PFX or SFX rule: its header plus all of its entries. */
interface AffixRule {
    type: AffixType;
    crossProduct: boolean;
    entries: AffixEntry[];
}
/** A suggestion list cached by suggest(). */
interface MemoizedSuggestions {
    suggestions: string[];
    limit: number;
}
/**
 * The dictionary table maps each stem to the list of flag strings it was listed with
 * (one string per .dic line), or to null when it was only ever listed without flags.
 */
type DictionaryTable = Map<string, string[] | null>;
declare class Typo {
    /** The locale code the dictionary was loaded for, e.g. "en_US". */
    dictionary: string | null;
    /** True once the dictionary has been parsed and the checker can be used. */
    loaded: boolean;
    /**
     * PFX and SFX rules, keyed by flag. If a flag names both a prefix rule and a suffix
     * rule, this holds the one defined last; both are applied when checking words.
     */
    rules: Record<string, AffixRule>;
    /** Stems and their flags. */
    dictionaryTable: DictionaryTable;
    /** COMPOUNDRULE patterns, as written in the .aff file. */
    compoundRules: string[];
    /** REP table: pairs of [misspelling, correction]. */
    replacementTable: [string, string][];
    /** Every other .aff directive, keyed by name, e.g. flags.NOSUGGEST === "!". */
    flags: Record<string, string>;
    /** Cached results of suggest(), keyed by the misspelled word. */
    memoized: Record<string, MemoizedSuggestions>;
    /**
     * Characters tried when generating suggestions. Built the first time suggest() has to
     * generate edits; a correctly spelled word or a REP table match leaves it empty.
     */
    alphabet: string;
    private flagMode;
    private flagAliases;
    private conditionCache;
    private suffixTrie;
    private prefixTrie;
    private suffixGroups;
    private prefixGroups;
    /** For each flag, the suffix entries that carry it on as a continuation flag. */
    private continuationIndex;
    private compiledCompoundRules;
    /** First characters of every stem that can begin a compound; prunes compound checks. */
    private compoundStarts;
    /** One-character stems that can end a compound. */
    private compoundSingleEnds;
    /** Flags that can begin / end a COMPOUNDRULE pattern, and all flags used by patterns. */
    private compoundStartFlags;
    private compoundEndFlags;
    private compoundFlags;
    /** Characters that occur in stems usable in compounds (ASCII bitmap plus other codes). */
    private compoundChars;
    private compoundCharsHigh;
    /** See buildPruneIndex(). */
    private startPairs;
    private endPairs;
    private startWild;
    private endWild;
    private pruneStart;
    private inputConversion;
    private outputConversion;
    private alphabetLetters;
    private alphabetUpper;
    private collator;
    /**
     * @param dictionary The locale code of the dictionary, e.g. "en_US". Used to locate
     *                   the dictionary files when their contents are not supplied.
     * @param affData    The contents of the .aff file. Omit to have it loaded from disk/URL.
     * @param wordsData  The contents of the .dic file. Omit to have it loaded from disk/URL.
     * @param settings   See TypoSettings.
     */
    constructor(dictionary?: string | null, affData?: string | false | null, wordsData?: string | false | null, settings?: TypoSettings | null);
    /**
     * Loads a dictionary asynchronously and resolves with the ready Typo instance.
     *
     * @example const dict = await Typo.load("en_US", { dictionaryPath: "dictionaries" });
     */
    static load(dictionary: string, settings?: Omit<TypoSettings, "asyncLoad" | "loadedCallback" | "errorCallback">): Promise<Typo>;
    private resolveDictionaryPath;
    private loadFilesSync;
    private loadFilesAsync;
    /**
     * Reads a file, as text. Uses XMLHttpRequest/fetch in browsers and the fs module in Node.js.
     *
     * @param path    The path or URL of the file.
     * @param charset The file's charset, as named on the .aff file's SET line. Defaults to UTF-8.
     * @param async   If true, a promise for the contents is returned instead of the contents.
     */
    _readFile(path: string, charset?: string | null): string;
    _readFile(path: string, charset: string | null | undefined, async: true): Promise<string>;
    _readFile(path: string, charset?: string | null, async?: boolean): string | Promise<string>;
    /**
     * Determines the charset of a dictionary from the SET line of its .aff file.
     *
     * @returns "utf8", or the charset name exactly as written in the file.
     */
    _getCharset(affData: string): string;
    private setup;
    private setupGenerator;
    /**
     * Removes a comment from a line of an affix file. Only whole-line comments are
     * removed, because "#" is a legitimate flag character in some dictionaries.
     */
    _removeAffixComments(line: string): string;
    /**
     * Parses an affix file. Besides returning the PFX/SFX rules, this fills in
     * compoundRules, replacementTable, flags and the conversion tables.
     */
    _parseAFF(data: string): Record<string, AffixRule>;
    private parseFlagMode;
    private parseTableLine;
    private parseAffixEntry;
    /**
     * Compiles a Hunspell affix condition. Conditions are sequences of literal characters,
     * "." (any character) and bracket groups ("[abc]", "[^abc]"); unlike regular expressions,
     * nothing else is special and "-" inside brackets is literal.
     */
    private compileCondition;
    private compileConditionUncached;
    /** Splits "text/flags" at the first unescaped slash, unescaping "\/" in the text. */
    private splitFlagField;
    /** Resolves an AF alias number to its flags; other flag strings are returned unchanged. */
    private resolveFlags;
    private parseConversionEntry;
    private compileConversionTable;
    private applyConversion;
    /**
     * Parses a COMPOUNDRULE pattern: a sequence of flags, each optionally followed by
     * "*" (zero or more) or "?" (zero or one). Flags longer than one character are
     * written in parentheses.
     */
    private compileCompoundRule;
    /** Indexes affix entries by the text they add, so that they can be found from a word. */
    private buildAffixIndexes;
    /** Splits a flag string into its individual flags, according to the FLAG directive. */
    private splitFlags;
    /** Public alias of splitFlags(), kept for 1.4.0 compatibility. */
    parseRuleCodes(flags: string): string[];
    /** Whether a flag string (one .dic entry's flags) contains a flag. */
    private flagsInclude;
    /** Whether a flag string contains every one of the given flags. */
    private flagsIncludeAll;
    /**
     * Whether a word is flagged with a given flag directive (e.g. "NOSUGGEST").
     *
     * @param word      The word, exactly as it appears in the dictionary.
     * @param flag      The name of the directive that defines the flag.
     * @param wordFlags Optional: a flag string, or an array of flag strings, to test instead
     *                  of looking the word up.
     */
    hasFlag(word: string, flag: string, wordFlags?: string | readonly string[]): boolean;
    /**
     * Parses a .dic file into a dictionary table. The table also becomes this instance's
     * dictionaryTable, and the pruning index is rebuilt for it.
     */
    _parseDIC(data: string): DictionaryTable;
    private parseDicGenerator;
    /**
     * Checks whether a word is spelled correctly. Surrounding whitespace is ignored, the
     * input conversion table (ICONV) is applied, and capitalization variants are tried.
     */
    check(word: string): boolean;
    /**
     * Checks a word and its capitalization variants exactly as given (no trimming or
     * input conversion).
     */
    private checkCaseVariants;
    /**
     * Checks whether a word, exactly as given, is a stem in the dictionary, an affixed
     * form of a stem, or a compound word allowed by the COMPOUNDRULE table.
     */
    checkExact(word: string): boolean;
    private acceptsExact;
    /**
     * A quick test that rejects most words the dictionary cannot possibly accept: every
     * accepted word starts and ends with a pair of characters that occurs at the start or
     * end of some stem or affix (see buildPruneIndex()). Only ASCII pairs are tested.
     */
    private mayBeKnown;
    /** Whether the word is listed in the dictionary as a word in its own right. */
    private isAcceptedStem;
    /**
     * Whether one of a stem's flag sets contains a flag, plus any further required flags,
     * and is not a FORBIDDENWORD entry.
     */
    private flagSetsHave;
    /**
     * Whether the word can be produced by adding one or two suffixes to a stem.
     *
     * @param word     The word (possibly with a prefix already stripped).
     * @param required Flags that the stem must carry unless a suffix carries them on as
     *                 continuation flags (e.g. the flag of a stripped prefix).
     * @param cross    Whether only cross-product suffixes may be used (set when a prefix
     *                 has been stripped).
     */
    private hasSuffixedForm;
    /** Whether one of a group's suffixes, removed from the word, leaves a stem (or a suffixed stem). */
    private suffixGroupMatches;
    /**
     * Whether the (already suffix-stripped) word can be produced by one of the given
     * suffixes, all of which carry the stripped suffix's flag as a continuation flag.
     */
    private hasContinuedForm;
    /** The required flags that an affix's continuation flags do not supply. */
    private flagsNotCarried;
    /** Whether the word can be produced by adding a prefix, optionally plus suffixes, to a stem. */
    private hasPrefixedForm;
    private prefixGroupMatches;
    /**
     * Whether the word (with a prefix already stripped) is a stem that takes the prefix,
     * plus a suffix named by the prefix's continuation flags.
     */
    private hasSuffixGrantedByPrefix;
    /** Whether the word matches one of the COMPOUNDRULE patterns. */
    private isCompound;
    private matchesCompoundRule;
    /**
     * Records the first and last two characters of every string the dictionary can accept,
     * in case-insensitive ASCII bitmaps, so that mayBeKnown() can reject most impossible
     * words without a hash lookup.
     *
     * An affix that strips text without adding any makes a word start or end in the middle
     * of a stem. For suffixes, what is left of each stem that takes one is recorded as well,
     * so the test on word endings always applies. For prefixes it is not, so such a prefix
     * disables the test on word beginnings.
     */
    private buildPruneIndex;
    /**
     * Suggests corrections for a misspelled word.
     *
     * Candidates are all strings within an edit distance of two from the word (deletions,
     * transpositions, replacements and insertions) that the dictionary accepts. They are
     * ranked by the number of different edit paths that produce them, which favors the
     * corrections closest to the misspelling.
     *
     * @param word  The misspelled word.
     * @param limit The maximum number of suggestions to return (default 5).
     */
    suggest(word: string, limit?: number): string[];
    /** Applies the output conversion table (OCONV) to suggestions, dropping duplicates. */
    private convertOutput;
    /** The REP table: the first replacement that produces a known word is the suggestion. */
    private suggestFromReplacements;
    private ensureAlphabet;
    /**
     * Calls visit() for the strings one edit away from the word: every deletion,
     * transposition and replacement, and every insertion before one of its characters.
     * Nothing is appended after the last character. A string is visited once for each edit
     * that produces it, and those repeat visits are what weight the suggestions.
     *
     * A character that is its own uppercase form (an uppercase letter, but also a digit, an
     * apostrophe or any other caseless character) is only replaced by uppercase letters, and
     * only uppercase letters are inserted before it when everything before it is uppercase
     * in the same sense. Those letters come from uppercasing the whole alphabet, which
     * already holds both a-z and A-Z, so each uppercase replacement or insertion is visited
     * at least twice. Elsewhere every letter of the alphabet is tried once. Typo.js 1.x
     * weighted its suggestions the same way, and the order of suggest() results depends on it.
     */
    private forEachEdit;
    private suggestFromEdits;
}
declare namespace Typo {
	export { TypoSettings, AffixType, AffixEntry, AffixRule, MemoizedSuggestions, DictionaryTable, Typo, Typo as default };
}
export = Typo;
