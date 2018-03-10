import * as fs from "fs";
import * as path from "path";
import {createTypo, ITypo} from "../src/typo";

let typo: ITypo;

beforeAll(() => {
  const testDir = path.dirname(require.main.filename);
  const dictData = JSON.parse(fs.readFileSync(`${testDir}/dictionaries/en.json`).toString());
  typo = createTypo({
    compoundRules: dictData.compoundRules,
    dictionaryTable: dictData.dictionaryTable,
    flags: dictData.flags,
    replacementTable: dictData.replacementTable,
  });
});

test("correct words return true to check", () => {
  expect(typo.check("I")).toBe(true);
  expect(typo.check("is")).toBe(true);
  expect(typo.check("makes")).toBe(true);
  expect(typo.check("example")).toBe(true);
  expect(typo.check("a")).toBe(true);
  expect(typo.check("aback")).toBe(true);
  expect(typo.check("juicily")).toBe(true);
  expect(typo.check("palmate")).toBe(true);
  expect(typo.check("palpable")).toBe(true);
});

test("Words not in the dictionary in any form are marked as misspelled.", () => {
  expect(typo.check("aaraara")).toBe(false);
  expect(typo.check("aaraara")).toBe(false);
  expect(typo.check("aaraara")).toBe(false);
  expect(typo.check("aaraara")).toBe(false);
  expect(typo.check("aaraara")).toBe(false);
});

test("Leading and trailing whitespace is ignored.", () => {
  expect(typo.check("concept ")).toBe(true);
  expect(typo.check(" concept")).toBe(true);
  expect(typo.check("  concept")).toBe(true);
  expect(typo.check("concept  ")).toBe(true);
  expect(typo.check("  concept  ")).toBe(true);
});

test("Possessives are properly checked.", () => {
  expect(typo.check("concept's")).toBe(true);
  // acceptability's is in the dictionary including the 's
  expect(typo.check("acceptability's's")).toBe(false);
});

test("Correct checking of root words with single affixes (affixes not used)", () => {
  expect(typo.check("paling")).toBe(true);
  expect(typo.check("arrangeable")).toBe(true);
  expect(typo.check("arrant")).toBe(true);
  expect(typo.check("swabby")).toBe(true);
});

test("Correct checking of root words with single affixes (affixes used)", () => {
  expect(typo.check("palmer's")).toBe(true);
  expect(typo.check("uncritically")).toBe(true);
  expect(typo.check("hypersensitiveness")).toBe(true);
  expect(typo.check("illusive")).toBe(true);
});

test("Capitalization is respected.", () => {
  expect(typo.check("A")).toBe(true);
  expect(typo.check("a")).toBe(true);
  expect(typo.check("AA")).toBe(true);
  expect(typo.check("ABANDONER")).toBe(true);
  expect(typo.check("abandonER")).toBe(true);
  expect(typo.check("Abandoner")).toBe(true);
  expect(typo.check("Abbe")).toBe(true);
  expect(typo.check("Abbott's")).toBe(true);
  expect(typo.check("abbott's")).toBe(false);
  expect(typo.check("Abba")).toBe(true);
  expect(typo.check("ABBA")).toBe(true);
  expect(typo.check("Abba's")).toBe(true);
  expect(typo.check("Yum")).toBe(true);
  expect(typo.check("yum")).toBe(true);
  expect(typo.check("YUM")).toBe(true);
  expect(typo.check("aa")).toBe(false);
  expect(typo.check("aaron")).toBe(false);
  expect(typo.check("abigael")).toBe(false);
  expect(typo.check("YVES")).toBe(true);
  expect(typo.check("yves")).toBe(false);
  expect(typo.check("Yves")).toBe(true);
  expect(typo.check("MACARTHUR")).toBe(true);
  expect(typo.check("MacArthur")).toBe(true);
  expect(typo.check("Alex")).toBe(true);
  expect(typo.check("alex")).toBe(false);
});

test("Contractions", () => {
  expect(typo.check("aren't")).toBe(true);
  expect(typo.check("I'm")).toBe(true);
  expect(typo.check("we're")).toBe(true);
  expect(typo.check("didn't")).toBe(true);
  expect(typo.check("didn'ts")).toBe(false);
  expect(typo.check("he're")).toBe(false);
});

test("ONLYINCOMPOUND flag is respected", () => {
  expect(typo.check("1th")).toBe(false);
  expect(typo.check("2th")).toBe(false);
  expect(typo.check("3th")).toBe(false);
});

test("Compound words", () => {
  expect(typo.check("1st")).toBe(true);
  expect(typo.check("2nd")).toBe(true);
  expect(typo.check("3rd")).toBe(true);
  expect(typo.check("4th")).toBe(true);
  expect(typo.check("5th")).toBe(true);
  expect(typo.check("6th")).toBe(true);
  expect(typo.check("7th")).toBe(true);
  expect(typo.check("8th")).toBe(true);
  expect(typo.check("9th")).toBe(true);
  expect(typo.check("10th")).toBe(true);
  expect(typo.check("11th")).toBe(true);
  expect(typo.check("12th")).toBe(true);
  expect(typo.check("13th")).toBe(true);
  expect(typo.check("2rd")).toBe(false);
  expect(typo.check("4rd")).toBe(false);
  expect(typo.check("100st")).toBe(false);
});

test("Suggestions", () => {
  expect(typo.suggest("speling", 3)).toEqual([ "spelling", "spieling", "spewing" ]);

  // Repeated calls function properly.
  expect(typo.suggest("speling", 1)).toEqual([ "spelling" ]);
  expect(typo.suggest("speling")).toEqual([ "spelling", "spieling", "spewing", "selling", "peeling" ]);
  expect(typo.suggest("speling", 2)).toEqual([ "spelling", "spieling" ]);
  expect(typo.suggest("speling")).toEqual([ "spelling", "spieling", "spewing", "selling", "peeling" ]);

  // Requesting more suggestions than will be returned doesn't break anything.
  expect(typo.suggest("spartang", 50)).toEqual([
    "spartan",
    "sparing",
    "starting",
    "sprang",
    "sporting", "spurting", "smarting", "sparking", "sparling", "sparring", "parting", "spatting",
  ]);
  expect(typo.suggest("spartang", 30)).toEqual([
    "spartan",
    "sparing",
    "starting",
    "sprang", "sporting", "spurting", "smarting", "sparking", "sparling", "sparring", "parting", "spatting" ]);
  expect(typo.suggest("spartang", 1)).toEqual([ "spartan" ]);

  expect(typo.suggest("spitting")).toEqual([ ]);
  expect(typo.suggest("spitting")).toEqual([ ]);

  // Words that are object properties don't break anything.
  expect(typo.suggest("length")).toEqual([ ]);
  expect(typo.suggest("length")).toEqual([ ]);
});
