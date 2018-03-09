export interface ITypo {
  check(word: string): boolean;
  suggest(word: string, limit?: number): string[];
}

export function createTypo(dictData: IDictData): ITypo {
  return new Typo(dictData);
}

export interface IDictData {
  compoundRules: RegExp[];
  dictionaryTable: {[key: string]: string[]};
  flags: {[key: string]: string};
  replacementTable: string[][];
}

export interface IMemo {
  limit: number;
  suggestions: string[];
}

export interface IReplacementEntry {
  oldAffix: string;
  newAffix: string;
}

class Typo implements ITypo {
  private alphabet: string = "";
  private compoundRules: RegExp[];
  private dictionaryTable: {[key: string]: string[]};
  private flags: {[key: string]: string};
  private memoized: {[word: string]: IMemo} = {};
  private replacementTable: IReplacementEntry[];

  constructor(dictData: IDictData) {
    this.compoundRules = dictData.compoundRules;
    this.dictionaryTable = dictData.dictionaryTable;
    this.flags = dictData.flags;
    this.replacementTable = dictData.replacementTable.map((entry: string[]) => {
      return {oldAffix: entry[0], newAffix: entry[1]};
    });
  }

  public check(aWord: string): boolean {
    // Remove leading and trailing whitespace
    const trimmedWord = aWord.replace(/^\s\s*/, "").replace(/\s\s*$/, "");

    if (this.checkExact(trimmedWord)) {
      return true;
    }

    // The exact word is not in the dictionary.
    if (trimmedWord.toUpperCase() === trimmedWord) {
      // The word was supplied in all uppercase.
      // Check for a capitalized form of the word.
      const capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();

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

  public suggest(word: string, limit = 5): string[] {

    if (this.memoized.hasOwnProperty(word)) {
      const memoizedLimit = this.memoized[word].limit;

      // Only return the cached list if it's big enough or if there weren't enough suggestions
      // to fill a smaller limit.
      if (limit <= memoizedLimit || this.memoized[word].suggestions.length < memoizedLimit) {
        return this.memoized[word].suggestions.slice(0, limit);
      }
    }

    if (this.check(word)) {
      return [];
    }

    // Check the replacement table.
    for (const replacementEntry of this.replacementTable) {
      if (word.indexOf(replacementEntry.oldAffix) !== -1) {
        const correctedWord = word.replace(replacementEntry.oldAffix, replacementEntry.newAffix);

        if (this.check(correctedWord)) {
          return [correctedWord];
        }
      }
    }

    this.alphabet = "abcdefghijklmnopqrstuvwxyz";

    this.memoized[word] = {
      limit,
      suggestions: this.correct(word, limit),
    };

    return this.memoized[word].suggestions;
  }

  private checkExact(word: string): boolean {
    const ruleCodes = this.dictionaryTable[word];
    if (typeof ruleCodes === "undefined") {
      // Check if this might be a compound word.
      if ("COMPOUNDMIN" in this.flags && word.length >= parseInt(this.flags.COMPOUNDMIN, 10)) {
        for (const rule of this.compoundRules) {
          if (word.match(rule)) {
            return true;
          }
        }
      }
    } else if (ruleCodes === null) {
      // a null (but not undefined) value for an entry in the dictionary table
      // means that the word is in the dictionary but has no flags.
      return true;
    } else if (typeof ruleCodes === "object") { // this.dictionary['hasOwnProperty'] will be a function.
      if (ruleCodes.length > 0) {
        for (const code of ruleCodes) {
          if (!this.hasFlag(word, "ONLYINCOMPOUND", code)) {
            return true;
          }
        }
      } else {
          return !this.hasFlag(word, "ONLYINCOMPOUND", []);
      }
    }
    return false;
  }

  private hasFlag(word: string, flag: string, wordFlags?: string | string[]) {
    if (flag in this.flags) {
      if (typeof wordFlags === "undefined") {
        wordFlags = Array.prototype.concat.apply([], this.dictionaryTable[word]);
      }

      if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
        return true;
      }
    }

    return false;
  }

  private edits1(words, knownOnly?) {
    const rv = {};

    if (typeof words === "string") {
      const word = words;
      words = {};
      words[word] = true;
    }

    for (const word in words) {
      if (words.hasOwnProperty(word)) {
        for (let i = 0; i < word.length + 1; i++) {
          let edit;
          const s = [ word.substring(0, i), word.substring(i) ];

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
            for (const letter of this.alphabet) {
              // Eliminate replacement of a letter by itself
              if (letter !== s[1].substring(0, 1)) {
                edit = s[0] + letter + s[0].substring(1);

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
            for (const letter of this.alphabet) {
              edit = s[0] + letter + s[1];
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
    }

    return rv;
  }

  private correct(word: string, limit: number): string[] {
    // Get the edit-distance-1 and edit-distance-2 forms of this word.
    const ed1 = this.edits1(word);
    const ed2 = this.edits1(ed1, true);

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
        sortedCorrections.push([ i, weightedCorrections[i] ]);
      }
    }

    sortedCorrections.sort(this.sorter).reverse();

    const rv: string[] = [];

    const capitalizationScheme = word.toUpperCase() === word
      ?  "uppercase"
      : word.substr(0, 1).toUpperCase() + word.substr(1).toLowerCase() === word
        ? "capitalized"
        : "lowercase";

    let workingLimit = limit;

    for (let i = 0; i < Math.min(workingLimit, sortedCorrections.length); i++) {
      if ("uppercase" === capitalizationScheme) {
        sortedCorrections[i][0] = sortedCorrections[i][0].toUpperCase();
      } else if ("capitalized" === capitalizationScheme) {
        sortedCorrections[i][0] = sortedCorrections[i][0].substr(0, 1).toUpperCase()
        + sortedCorrections[i][0].substr(1);
      }

      if (
        !this.hasFlag(sortedCorrections[i][0], "NOSUGGEST")
      && rv.indexOf(sortedCorrections[i][0]) === -1) {
        rv.push(sortedCorrections[i][0]);
      } else {
        // If one of the corrections is not eligible as a suggestion,
        // make sure we still return the right number of suggestions.
        workingLimit++;
      }
    }

    return rv;
  }

  private sorter(a, b) {
    if (a[1] < b[1]) {
      return -1;
    }
    return 1;
  }
}
