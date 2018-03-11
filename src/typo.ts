export interface ITypo {
  check(word: string): boolean;
  suggest(word: string, limit?: number): string[];
}

export function createTypo(dictData: IDictData): ITypo {
  return new Typo(dictData);
}

export interface IDictData {
  compoundRules: string[];
  dictionaryTable: {[key: string]: string[]};
  flags: {[key: string]: string};
  replacementTable: string[][];
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
  private replacementTable: IReplacementEntry[];

  constructor(dictData: IDictData) {
    this.compoundRules = dictData.compoundRules.map((rule) => {
      const ruleSet = rule.split("/").slice(1);
      return new RegExp(ruleSet[0], ruleSet[1]);
    });
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

    if (this.check(word)) {
      return [];
    }

    // Check the replacement table.
    for (const replacementEntry of this.replacementTable) {

      if (word.indexOf(replacementEntry[0]) !== -1) {
        const correctedWord = word.replace(replacementEntry.oldAffix, replacementEntry.newAffix);

        if (this.check(correctedWord)) {
          return [ correctedWord ];
        }
      }
    }

    this.alphabet = "abcdefghijklmnopqrstuvwxyz";
    return this.correct(word, limit);
  }

  private checkExact(word: string): boolean {
    const ruleCodes = this.dictionaryTable[word];
    if (ruleCodes == null) {
      // Check if this might be a compound word.
      if ("COMPOUNDMIN" in this.flags && word.length >= parseInt(this.flags.COMPOUNDMIN, 10)) {
        for (const rule of this.compoundRules) {
          if (word.match(rule)) {
            return true;
          }
        }
      }
    } else if (ruleCodes.length === 0) {
      // an empty value for an entry in the dictionary table
      // means that the word is in the dictionary but has no flags.
      return true;
    } else {
      return !this.hasFlag(word, "ONLYINCOMPOUND", ruleCodes);
    }
    return false;
  }

  private hasFlag(word: string, flag: string, wordFlags: string[] = this.dictionaryTable[word]) {
    return wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1;
  }

  private edits1(words) {
    let rv = [];

    for (const word of words) {

      const splits = [];

      for (let i = 0; i < word.length + 1; i++) {
        splits.push([ word.substring(0, i), word.substring(i, word.length) ]);
      }

      const deletes = [];

      for (const s of splits) {
        if (s[1]) {
          deletes.push(s[0] + s[1].substring(1));
        }
      }

      const transposes = [];

      for (const s of splits) {
        if (s[1].length > 1) {
          transposes.push(s[0] + s[1][1] + s[1][0] + s[1].substring(2));
        }
      }

      const replaces = [];

      for (const s of splits) {
        if (s[1]) {
          for (const letter of this.alphabet) {
            replaces.push(s[0] + letter + s[1].substring(1));
          }
        }
      }

      const inserts = [];

      for (const s of splits) {
        if (s[1]) {
          for (const letter of this.alphabet) {
            replaces.push(s[0] + letter + s[1]);
          }
        }
      }

      rv = Array.prototype.concat.apply(rv, [deletes, transposes, replaces, inserts]);
    }

    return rv;
  }

  private known(words) {
    const rv = [];

    for (const word of words) {
      if (this.check(word)) {
        rv.push(word);
      }
    }

    return rv;
  }

  private correct(word, limit) {
    // Get the edit-distance-1 and edit-distance-2 forms of this word.
    const ed1 = this.edits1([word]);
    const ed2 = this.edits1(ed1);

    const corrections = this.known(ed1).concat(this.known(ed2));

    // Sort the edits based on how many different ways they were created.
    const weightedCorrections = {};

    for (const c of corrections) {
      if (!(c in weightedCorrections)) {
        weightedCorrections[c] = 0;
      } else {
        weightedCorrections[c] += 1;
      }
    }

    const sortedCorrections = [];

    for (const wc in weightedCorrections) {
      if (weightedCorrections.hasOwnProperty(wc)) {
        sortedCorrections.push([ wc, weightedCorrections[wc] ]);
      }
    }

    sortedCorrections.sort(this.sorter).reverse();

    const rv = [];

    for (let i = 0, len = Math.min(limit, sortedCorrections.length); i < len; i++) {
      if (!this.hasFlag(sortedCorrections[i][0], "NOSUGGEST")) {
        rv.push(sortedCorrections[i][0]);
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
