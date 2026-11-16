/* Typo.js — a Hunspell-style spellchecker. BSD-3-Clause. https://github.com/cfinke/Typo.js */
"use strict";
var Typo = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ts/typo.ts
  var typo_exports = {};
  __export(typo_exports, {
    Typo: () => Typo,
    default: () => typo_default
  });
  var import_meta = {};
  var DEFAULT_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var DEFAULT_SUGGESTION_LIMIT = 5;
  var PRIORITY_SUGGESTION_BONUS = 1e3;
  var DEFAULT_COMPOUND_MIN = 3;
  var MAP_MAX_SUBSTITUTIONS = 3;
  var MAP_MAX_CANDIDATES = 2e3;
  var NOT_LOADED_ERROR = "Dictionary not loaded.";
  var ASYNC_PARSE_BATCH = 1024;
  function nodeFs() {
    const proc = globalThis.process;
    if (proc && typeof proc.getBuiltinModule === "function") {
      return proc.getBuiltinModule("node:fs");
    }
    if (typeof __require === "function") {
      try {
        return __require("fs");
      } catch {
        return null;
      }
    }
    return null;
  }
  function isNode() {
    const proc = globalThis.process;
    return !!(proc && proc.versions && proc.versions.node);
  }
  var moduleDirectory = (() => {
    try {
      if (typeof __dirname === "string") {
        return __dirname;
      }
      const url = import_meta.url;
      if (url && url.startsWith("file:")) {
        let dir = decodeURIComponent(new URL(".", url).pathname);
        if (/^\/[A-Za-z]:\//.test(dir)) {
          dir = dir.substring(1);
        }
        return dir.replace(/\/$/, "");
      }
    } catch {
    }
    return null;
  })();
  function defaultDictionaryPathWithoutWindow() {
    return (moduleDirectory === null ? "." : moduleDirectory) + "/dictionaries";
  }
  function normalizeCharset(charset) {
    if (!charset) {
      return "utf-8";
    }
    const lower = charset.trim().toLowerCase();
    if (lower === "utf8" || lower === "utf-8") {
      return "utf-8";
    }
    const cp = lower.match(/^microsoft-cp(\d+)$/);
    if (cp) {
      return "windows-" + cp[1];
    }
    if (lower === "tis620-2533") {
      return "tis-620";
    }
    return lower;
  }
  function decodeBytes(bytes, charset) {
    const label = normalizeCharset(charset);
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      console.warn(`Typo.js: unsupported charset "${charset}", decoding as UTF-8 instead.`);
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  var EMPTY_FLAGS = [];
  function asciiUpper(code) {
    return code >= 97 && code <= 122 ? code - 32 : code;
  }
  function addPair(bitmap, first, second) {
    if (first >= 128 || second >= 128) {
      return;
    }
    const upperFirst = asciiUpper(first);
    const upperSecond = asciiUpper(second);
    setPairBit(bitmap, first, second);
    setPairBit(bitmap, upperFirst, second);
    setPairBit(bitmap, first, upperSecond);
    setPairBit(bitmap, upperFirst, upperSecond);
  }
  function setPairBit(bitmap, first, second) {
    const key = first << 7 | second;
    bitmap[key >> 3] |= 1 << (key & 7);
  }
  function trieChild(node, code) {
    if (node.children === null) {
      node.children = /* @__PURE__ */ new Map();
    }
    let child = node.children.get(code);
    if (!child) {
      child = { children: null, groups: null };
      node.children.set(code, child);
    }
    return child;
  }
  function firstWhitespace(line) {
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code === 32 || code === 9 || code === 13 || code >= 10 && code <= 12 || code >= 128 && /\s/.test(line[i])) {
        return i;
      }
    }
    return -1;
  }
  function isAllUpperCase(word) {
    for (let i = 0; i < word.length; i++) {
      const code = word.charCodeAt(i);
      if (code >= 97 && code <= 122) {
        return false;
      }
      if (code >= 128) {
        return word.toUpperCase() === word;
      }
    }
    return true;
  }
  function hasUpperCaseInitial(word) {
    const code = word.charCodeAt(0);
    if (code < 128) {
      return code >= 65 && code <= 90;
    }
    return word[0].toLowerCase() !== word[0];
  }
  function runInSlices(generator) {
    const win = globalThis.window;
    const requestIdle = win && typeof win.requestIdleCallback === "function" ? win.requestIdleCallback.bind(win) : typeof globalThis.requestIdleCallback === "function" ? globalThis.requestIdleCallback.bind(globalThis) : void 0;
    return new Promise((resolve, reject) => {
      function step(deadline) {
        try {
          const start = Date.now();
          for (; ; ) {
            if (generator.next().done) {
              resolve();
              return;
            }
            const outOfTime = deadline ? deadline.timeRemaining() <= 0 : Date.now() - start >= 12;
            if (outOfTime) {
              schedule();
              return;
            }
          }
        } catch (error) {
          reject(error);
        }
      }
      function schedule() {
        if (requestIdle) {
          requestIdle(step);
        } else {
          setTimeout(() => step(), 0);
        }
      }
      schedule();
    });
  }
  var Typo = class _Typo {
    /**
     * @param dictionary The locale code of the dictionary, e.g. "en_US". Used to locate
     *                   the dictionary files when their contents are not supplied.
     * @param affData    The contents of the .aff file. Omit to have it loaded from disk/URL.
     * @param wordsData  The contents of the .dic file. Omit to have it loaded from disk/URL.
     * @param settings   See TypoSettings.
     */
    constructor(dictionary, affData, wordsData, settings) {
      /** The locale code the dictionary was loaded for, e.g. "en_US". */
      this.dictionary = null;
      /** True once the dictionary has been parsed and the checker can be used. */
      this.loaded = false;
      /**
       * PFX and SFX rules, keyed by flag. If a flag names both a prefix rule and a suffix
       * rule, this holds the one defined last; both are applied when checking words.
       */
      this.rules = {};
      /** Stems and their flags. */
      this.dictionaryTable = /* @__PURE__ */ new Map();
      /** COMPOUNDRULE patterns, as written in the .aff file. */
      this.compoundRules = [];
      /**
       * REP table: pairs of [misspelling, correction], as written in the .aff file. A
       * misspelling may start with "^" or end with "$" to only match the start or the end of a word.
       */
      this.replacementTable = [];
      /** MAP table: groups of related characters (or character sequences), e.g. ["e", "é", "è"]. */
      this.mapTable = [];
      /** Cached results of suggest(), keyed by the misspelled word. */
      this.memoized = /* @__PURE__ */ Object.create(null);
      /**
       * Characters tried when generating suggestions. Built the first time suggest() has to
       * generate edits; a correctly spelled word or a REP table match leaves it empty.
       */
      this.alphabet = "";
      this.flagMode = "char";
      this.flagAliases = [];
      this.conditionCache = /* @__PURE__ */ new Map();
      this.suffixTrie = { children: null, groups: null };
      this.prefixTrie = { children: null, groups: null };
      this.suffixGroups = [];
      this.prefixGroups = [];
      /** For each flag, the suffix entries that carry it on as a continuation flag. */
      this.continuationIndex = /* @__PURE__ */ new Map();
      this.compiledCompoundRules = [];
      /** First characters of every stem that can begin a compound; prunes compound checks. */
      this.compoundStarts = /* @__PURE__ */ new Set();
      /** One-character stems that can end a compound. */
      this.compoundSingleEnds = /* @__PURE__ */ new Set();
      /** Flags that can begin / end a COMPOUNDRULE pattern, and all flags used by patterns. */
      this.compoundStartFlags = /* @__PURE__ */ new Set();
      this.compoundEndFlags = /* @__PURE__ */ new Set();
      this.compoundFlags = /* @__PURE__ */ new Set();
      /** Characters that occur in stems usable in compounds (ASCII bitmap plus other codes). */
      this.compoundChars = new Uint8Array(128);
      this.compoundCharsHigh = /* @__PURE__ */ new Set();
      /** See buildPruneIndex(). */
      this.startPairs = new Uint8Array(0);
      this.endPairs = new Uint8Array(0);
      this.startWild = new Uint8Array(128);
      this.endWild = new Uint8Array(128);
      this.pruneStart = false;
      /** See buildStemPrefixIndex(). Null until suggest() first needs it. */
      this.stemPrefixBits = null;
      this.stemPrefixMask = 0;
      /** Whether the last hasSuffixedForm() call found any suffix worth looking a stem up for. */
      this.suffixLookupTried = false;
      this.inputConversion = null;
      this.outputConversion = null;
      this.alphabetLetters = [];
      this.alphabetUpper = [];
      this.collator = new Intl.Collator();
      const options = settings && typeof settings === "object" ? settings : {};
      this.flags = options.flags ? { ...options.flags } : {};
      if (!dictionary) {
        return;
      }
      this.dictionary = dictionary;
      const reportError = (error) => {
        if (options.errorCallback) {
          options.errorCallback(error);
        } else {
          console.error("Typo.js: error while loading dictionary.", error);
        }
      };
      if (affData && wordsData) {
        const result = this.setup(affData, wordsData, options);
        if (result) {
          result.catch(reportError);
        }
        return;
      }
      const base = this.resolveDictionaryPath(options);
      const affPath = `${base}/${dictionary}/${dictionary}.aff`;
      const dicPath = `${base}/${dictionary}/${dictionary}.dic`;
      if (options.asyncLoad) {
        this.loadFilesAsync(affPath, dicPath, affData || null, wordsData || null, options).catch(reportError);
      } else {
        this.loadFilesSync(affPath, dicPath, affData || null, wordsData || null, options);
      }
    }
    /**
     * Loads a dictionary asynchronously and resolves with the ready Typo instance.
     *
     * @example const dict = await Typo.load("en_US", { dictionaryPath: "dictionaries" });
     */
    static load(dictionary, settings = {}) {
      return new Promise((resolve, reject) => {
        new _Typo(dictionary, null, null, {
          ...settings,
          asyncLoad: true,
          loadedCallback: resolve,
          errorCallback: reject
        });
      });
    }
    /* --------------------------------------------------------------------------------------------
     * Loading
     * ------------------------------------------------------------------------------------------ */
    resolveDictionaryPath(options) {
      const win = globalThis.window;
      let base;
      if (options.dictionaryPath) {
        base = options.dictionaryPath;
      } else if (win) {
        base = "typo/dictionaries";
      } else {
        base = defaultDictionaryPathWithoutWindow();
      }
      if (win) {
        const runtime = win.chrome && win.chrome.runtime || win.browser && win.browser.runtime;
        if (runtime && typeof runtime.getURL === "function") {
          base = runtime.getURL(base);
        }
      }
      return base.replace(/\/+$/, "");
    }
    loadFilesSync(affPath, dicPath, affData, wordsData, options) {
      if (!affData) {
        affData = this._readFile(affPath);
        const charset = this._getCharset(affData);
        if (charset !== "utf8") {
          affData = this._readFile(affPath, charset);
        }
      }
      if (!wordsData) {
        wordsData = this._readFile(dicPath, this._getCharset(affData));
      }
      this.setup(affData, wordsData, options);
    }
    async loadFilesAsync(affPath, dicPath, affData, wordsData, options) {
      if (!affData) {
        affData = await this._readFile(affPath, void 0, true);
        const charset = this._getCharset(affData);
        if (charset !== "utf8") {
          affData = await this._readFile(affPath, charset, true);
        }
      }
      if (!wordsData) {
        wordsData = await this._readFile(dicPath, this._getCharset(affData), true);
      }
      await this.setup(affData, wordsData, options);
    }
    _readFile(path, charset, async) {
      const encoding = charset || "utf8";
      if (isNode()) {
        const fs = nodeFs();
        if (!fs) {
          throw new Error("Typo.js: the fs module is not available; pass the dictionary contents to the constructor instead.");
        }
        if (async) {
          return fs.promises.readFile(path).then((bytes) => decodeBytes(bytes, encoding));
        }
        return decodeBytes(fs.readFileSync(path), encoding);
      }
      if (async && typeof fetch === "function") {
        return fetch(path).then((response) => {
          if (!response.ok) {
            throw new Error(`Typo.js: could not load ${path} (${response.status} ${response.statusText}).`);
          }
          return response.arrayBuffer();
        }).then((buffer) => decodeBytes(new Uint8Array(buffer), encoding));
      }
      if (typeof XMLHttpRequest === "function") {
        const request = new XMLHttpRequest();
        request.open("GET", path, !!async);
        if (typeof request.overrideMimeType === "function") {
          request.overrideMimeType("text/plain; charset=" + normalizeCharset(encoding));
        }
        if (async) {
          return new Promise((resolve, reject) => {
            request.onload = () => {
              if (request.status === 200 || request.status === 0 && request.responseText) {
                resolve(request.responseText);
              } else {
                reject(new Error(`Typo.js: could not load ${path} (${request.status} ${request.statusText}).`));
              }
            };
            request.onerror = () => reject(new Error(`Typo.js: could not load ${path}.`));
            request.send(null);
          });
        }
        request.send(null);
        if (request.status !== 200 && !(request.status === 0 && request.responseText)) {
          throw new Error(`Typo.js: could not load ${path} (${request.status} ${request.statusText}).`);
        }
        return request.responseText;
      }
      throw new Error("Typo.js: no way to read files in this environment; pass the dictionary contents to the constructor instead.");
    }
    /**
     * Determines the charset of a dictionary from the SET line of its .aff file.
     *
     * @returns "utf8", or the charset name exactly as written in the file.
     */
    _getCharset(affData) {
      const match = affData.match(/^[ \t]*SET[ \t]+(\S+)/m);
      if (!match || /^utf-?8$/i.test(match[1])) {
        return "utf8";
      }
      return match[1];
    }
    setup(affData, wordsData, options) {
      const parse = this.setupGenerator(affData, wordsData);
      if (!options.asyncLoad) {
        while (!parse.next().done) {
        }
        return;
      }
      return runInSlices(parse).then(() => {
        if (options.loadedCallback) {
          options.loadedCallback(this);
        }
      });
    }
    *setupGenerator(affData, wordsData) {
      this.rules = this._parseAFF(affData);
      yield;
      this.dictionaryTable = yield* this.parseDicGenerator(wordsData);
      yield;
      this.buildPruneIndex();
      this.loaded = true;
    }
    /* --------------------------------------------------------------------------------------------
     * Affix file parsing
     * ------------------------------------------------------------------------------------------ */
    /**
     * Removes a comment from a line of an affix file. Only whole-line comments are
     * removed, because "#" is a legitimate flag character in some dictionaries.
     */
    _removeAffixComments(line) {
      return /^\s*#/.test(line) ? "" : line;
    }
    /**
     * Parses an affix file. Besides returning the PFX/SFX rules, this fills in
     * compoundRules, replacementTable, flags and the conversion tables.
     */
    _parseAFF(data) {
      const rules = {};
      const rulesByType = /* @__PURE__ */ new Map();
      const lines = data.replace(/^\uFEFF/, "").split(/\r?\n/);
      const inputConversions = [];
      const outputConversions = [];
      this.flagMode = this.parseFlagMode(this.flags.FLAG);
      this.flagAliases = [];
      this.conditionCache = /* @__PURE__ */ new Map();
      this.compoundRules = [];
      this.replacementTable = [];
      this.mapTable = [];
      const tables = /* @__PURE__ */ new Set(["REP", "ICONV", "OCONV", "COMPOUNDRULE", "AF", "AM", "MAP", "BREAK", "PHONE", "CHECKCOMPOUNDPATTERN"]);
      let i = 0;
      const nextTableLine = (directive, flag) => {
        let j = i + 1;
        while (j < lines.length && !this._removeAffixComments(lines[j]).trim()) {
          j++;
        }
        if (j >= lines.length) {
          return null;
        }
        const parts = lines[j].trim().split(/\s+/);
        if (parts[0] !== directive || flag !== void 0 && parts[1] !== flag) {
          return null;
        }
        i = j;
        return parts;
      };
      for (; i < lines.length; i++) {
        const line = this._removeAffixComments(lines[i]).trim();
        if (!line) {
          continue;
        }
        const parts = line.split(/\s+/);
        const directive = parts[0];
        if (directive === "PFX" || directive === "SFX") {
          const flag = parts[1];
          const crossProduct = parts[2] === "Y";
          let count = parseInt(parts[3], 10);
          if (!flag || isNaN(count)) {
            continue;
          }
          const ruleKey = directive + " " + flag;
          let rule = rulesByType.get(ruleKey);
          if (!rule) {
            rule = { type: directive, crossProduct, entries: [] };
            rulesByType.set(ruleKey, rule);
          }
          rules[flag] = rule;
          while (count-- > 0) {
            const entryParts = nextTableLine(directive, flag);
            if (!entryParts) {
              break;
            }
            rule.entries.push(this.parseAffixEntry(directive, flag, rule.crossProduct, entryParts));
          }
        } else if (directive === "FLAG") {
          this.flags.FLAG = parts[1];
          this.flagMode = this.parseFlagMode(parts[1]);
        } else if (tables.has(directive)) {
          let count = parseInt(parts[1], 10);
          if (parts.length !== 2 || isNaN(count)) {
            this.parseTableLine(directive, parts, inputConversions, outputConversions);
            continue;
          }
          while (count-- > 0) {
            const tableParts = nextTableLine(directive);
            if (!tableParts) {
              break;
            }
            this.parseTableLine(directive, tableParts, inputConversions, outputConversions);
          }
        } else {
          this.flags[directive] = parts.slice(1).join(" ");
        }
      }
      this.buildAffixIndexes(rulesByType.values());
      this.compiledCompoundRules = this.compoundRules.map((pattern) => this.compileCompoundRule(pattern));
      this.compoundStartFlags = /* @__PURE__ */ new Set();
      this.compoundEndFlags = /* @__PURE__ */ new Set();
      this.compoundFlags = new Set(this.compiledCompoundRules.flatMap((rule) => rule.items.map((item) => item.flag)));
      for (const rule of this.compiledCompoundRules) {
        for (let k = 0; k < rule.items.length; k++) {
          this.compoundStartFlags.add(rule.items[k].flag);
          if (!rule.items[k].optional) {
            break;
          }
        }
        for (let k = rule.items.length - 1; k >= 0; k--) {
          this.compoundEndFlags.add(rule.items[k].flag);
          if (!rule.items[k].optional) {
            break;
          }
        }
      }
      this.inputConversion = this.compileConversionTable(inputConversions);
      this.outputConversion = this.compileConversionTable(outputConversions);
      return rules;
    }
    parseFlagMode(value) {
      switch ((value || "").toLowerCase()) {
        case "long":
          return "long";
        case "num":
          return "num";
        case "utf-8":
        case "utf8":
          return "utf8";
        default:
          return "char";
      }
    }
    parseTableLine(directive, parts, inputConversions, outputConversions) {
      switch (directive) {
        case "REP":
          if (parts.length >= 3) {
            this.replacementTable.push([parts[1].replace(/_/g, " "), parts[2].replace(/_/g, " ")]);
          }
          break;
        case "ICONV":
        case "OCONV":
          if (parts.length >= 3) {
            (directive === "ICONV" ? inputConversions : outputConversions).push(this.parseConversionEntry(parts[1], parts[2]));
          }
          break;
        case "COMPOUNDRULE":
          if (parts.length >= 2) {
            this.compoundRules.push(parts[1]);
          }
          break;
        case "AF":
          this.flagAliases.push(parts[1] || "");
          break;
        case "MAP": {
          const group = (parts[1] || "").match(/\([^)]*\)|[\uD800-\uDBFF][\uDC00-\uDFFF]|[^()]/g);
          if (group) {
            const items = group.map((item) => item.length > 1 && item[0] === "(" ? item.slice(1, -1) : item).filter((item) => item);
            if (items.length > 1) {
              this.mapTable.push(items);
            }
          }
          break;
        }
        default:
          break;
      }
    }
    parseAffixEntry(type, flag, crossProduct, parts) {
      const strip = parts[2] === "0" || parts[2] === void 0 ? "" : parts[2];
      const [addField, continuationField] = this.splitFlagField(parts[3] || "0");
      const add = addField === "0" ? "" : addField;
      const conditionText = parts[4] || ".";
      return {
        flag,
        type,
        crossProduct,
        strip,
        add,
        condition: this.compileCondition(type, conditionText),
        continuation: continuationField === null ? "" : this.resolveFlags(continuationField)
      };
    }
    /**
     * Compiles a Hunspell affix condition. Conditions are sequences of literal characters,
     * "." (any character) and bracket groups ("[abc]", "[^abc]"); unlike regular expressions,
     * nothing else is special and "-" inside brackets is literal.
     */
    compileCondition(type, condition) {
      if (condition === "." || condition === "") {
        return null;
      }
      const cacheKey = type + " " + condition;
      const cached = this.conditionCache.get(cacheKey);
      if (cached !== void 0) {
        return cached;
      }
      const compiled = this.compileConditionUncached(type, condition);
      this.conditionCache.set(cacheKey, compiled);
      return compiled;
    }
    compileConditionUncached(type, condition) {
      let source = "";
      for (let i = 0; i < condition.length; i++) {
        const ch = condition[i];
        if (ch === "[") {
          const end = condition.indexOf("]", i + 1);
          if (end === -1) {
            source += escapeRegExp(ch);
            continue;
          }
          let members = condition.substring(i + 1, end);
          let negated = false;
          if (members.startsWith("^")) {
            negated = true;
            members = members.substring(1);
          }
          source += "[" + (negated ? "^" : "") + members.replace(/[\]\\^-]/g, "\\$&") + "]";
          i = end;
        } else if (ch === ".") {
          source += ".";
        } else {
          source += escapeRegExp(ch);
        }
      }
      try {
        return new RegExp(type === "SFX" ? source + "$" : "^" + source);
      } catch {
        return null;
      }
    }
    /** Splits "text/flags" at the first unescaped slash, unescaping "\/" in the text. */
    splitFlagField(field) {
      let slash = -1;
      for (let i = 0; i < field.length; i++) {
        if (field[i] === "\\") {
          i++;
        } else if (field[i] === "/") {
          slash = i;
          break;
        }
      }
      if (slash === -1) {
        return [field.replace(/\\\//g, "/"), null];
      }
      return [field.substring(0, slash).replace(/\\\//g, "/"), field.substring(slash + 1)];
    }
    /** Resolves an AF alias number to its flags; other flag strings are returned unchanged. */
    resolveFlags(field) {
      if (this.flagAliases.length > 0 && /^\d+$/.test(field)) {
        const alias = this.flagAliases[parseInt(field, 10) - 1];
        if (alias !== void 0) {
          return alias;
        }
      }
      return field;
    }
    parseConversionEntry(pattern, replacement) {
      let atStart = false;
      let atEnd = false;
      if (pattern.length > 1 && pattern.startsWith("_")) {
        atStart = true;
        pattern = pattern.substring(1);
      }
      if (pattern.length > 1 && pattern.endsWith("_")) {
        atEnd = true;
        pattern = pattern.substring(0, pattern.length - 1);
      }
      return {
        pattern: pattern.replace(/_/g, " "),
        replacement: replacement.replace(/_/g, " "),
        atStart,
        atEnd
      };
    }
    compileConversionTable(entries) {
      if (entries.length === 0) {
        return null;
      }
      const sorted = entries.slice().sort((a, b) => b.pattern.length - a.pattern.length);
      const anchored = sorted.filter((entry) => entry.atStart || entry.atEnd);
      const plain = sorted.filter((entry) => !entry.atStart && !entry.atEnd);
      const replacements = /* @__PURE__ */ new Map();
      for (const entry of plain) {
        if (!replacements.has(entry.pattern)) {
          replacements.set(entry.pattern, entry.replacement);
        }
      }
      return {
        anchored,
        regex: replacements.size > 0 ? new RegExp([...replacements.keys()].map(escapeRegExp).join("|"), "g") : null,
        replacements
      };
    }
    applyConversion(word, table) {
      if (!table) {
        return word;
      }
      for (const entry of table.anchored) {
        if (entry.atStart && entry.atEnd) {
          if (word === entry.pattern) {
            word = entry.replacement;
          }
        } else if (entry.atStart) {
          if (word.startsWith(entry.pattern)) {
            word = entry.replacement + word.substring(entry.pattern.length);
          }
        } else if (word.endsWith(entry.pattern)) {
          word = word.substring(0, word.length - entry.pattern.length) + entry.replacement;
        }
      }
      if (table.regex) {
        word = word.replace(table.regex, (match) => table.replacements.get(match) ?? match);
      }
      return word;
    }
    /**
     * Parses a COMPOUNDRULE pattern: a sequence of flags, each optionally followed by
     * "*" (zero or more) or "?" (zero or one). Flags longer than one character are
     * written in parentheses.
     */
    compileCompoundRule(pattern) {
      const items = [];
      for (let i = 0; i < pattern.length; i++) {
        let flag;
        if (pattern[i] === "(") {
          const end = pattern.indexOf(")", i + 1);
          if (end === -1) {
            flag = pattern[i];
          } else {
            flag = pattern.substring(i + 1, end);
            i = end;
          }
        } else {
          flag = pattern[i];
        }
        const item = { flag, optional: false, repeatable: false };
        if (pattern[i + 1] === "*") {
          item.optional = true;
          item.repeatable = true;
          i++;
        } else if (pattern[i + 1] === "?") {
          item.optional = true;
          i++;
        }
        items.push(item);
      }
      return { pattern, items };
    }
    /** Indexes affix entries by the text they add, so that they can be found from a word. */
    buildAffixIndexes(rules) {
      this.suffixTrie = { children: null, groups: null };
      this.prefixTrie = { children: null, groups: null };
      this.suffixGroups = [];
      this.prefixGroups = [];
      this.continuationIndex = /* @__PURE__ */ new Map();
      const groupsByAdd = { SFX: /* @__PURE__ */ new Map(), PFX: /* @__PURE__ */ new Map() };
      for (const rule of rules) {
        const index = groupsByAdd[rule.type];
        for (const entry of rule.entries) {
          let groups = index.get(entry.add);
          if (!groups) {
            groups = [];
            index.set(entry.add, groups);
          }
          let group = groups.find((candidate) => candidate.strip === entry.strip);
          if (!group) {
            group = { add: entry.add, strip: entry.strip, entries: [], continued: false };
            groups.push(group);
            (rule.type === "SFX" ? this.suffixGroups : this.prefixGroups).push(group);
          }
          group.entries.push(entry);
          if (entry.continuation && rule.type === "SFX") {
            for (const continued of this.splitFlags(entry.continuation)) {
              let continuers = this.continuationIndex.get(continued);
              if (!continuers) {
                continuers = [];
                this.continuationIndex.set(continued, continuers);
              }
              continuers.push(entry);
            }
          }
        }
      }
      for (const group of this.suffixGroups) {
        group.continued = group.entries.some((entry) => this.continuationIndex.has(entry.flag));
      }
      for (const [add, groups] of groupsByAdd.SFX) {
        let node = this.suffixTrie;
        for (let i = add.length - 1; i >= 0; i--) {
          node = trieChild(node, add.charCodeAt(i));
        }
        node.groups = groups;
      }
      for (const [add, groups] of groupsByAdd.PFX) {
        let node = this.prefixTrie;
        for (let i = 0; i < add.length; i++) {
          node = trieChild(node, add.charCodeAt(i));
        }
        node.groups = groups;
      }
    }
    /* --------------------------------------------------------------------------------------------
     * Flags
     * ------------------------------------------------------------------------------------------ */
    /** Splits a flag string into its individual flags, according to the FLAG directive. */
    splitFlags(flags) {
      if (!flags) {
        return [];
      }
      switch (this.flagMode) {
        case "long": {
          const result = [];
          for (let i = 0; i < flags.length; i += 2) {
            result.push(flags.substring(i, i + 2));
          }
          return result;
        }
        case "num":
          return flags.split(",").filter((flag) => flag !== "");
        case "utf8":
          return Array.from(flags);
        default:
          return flags.split("");
      }
    }
    /** Public alias of splitFlags(), kept for 1.4.0 compatibility. */
    parseRuleCodes(flags) {
      return this.splitFlags(flags);
    }
    /** Whether a flag string (one .dic entry's flags) contains a flag. */
    flagsInclude(flags, flag) {
      if (!flags || !flag) {
        return false;
      }
      switch (this.flagMode) {
        case "long":
          if (flag.length !== 2) {
            return flags.includes(flag);
          }
          for (let i = 0; i + 1 < flags.length; i += 2) {
            if (flags.charCodeAt(i) === flag.charCodeAt(0) && flags.charCodeAt(i + 1) === flag.charCodeAt(1)) {
              return true;
            }
          }
          return false;
        case "num":
          return ("," + flags + ",").includes("," + flag + ",");
        default:
          return flags.includes(flag);
      }
    }
    /** Whether a flag string contains every one of the given flags. */
    flagsIncludeAll(flags, required) {
      for (const flag of required) {
        if (!this.flagsInclude(flags, flag)) {
          return false;
        }
      }
      return true;
    }
    /**
     * Whether a word is flagged with a given flag directive (e.g. "NOSUGGEST").
     *
     * @param word      The word, exactly as it appears in the dictionary.
     * @param flag      The name of the directive that defines the flag.
     * @param wordFlags Optional: a flag string, or an array of flag strings, to test instead
     *                  of looking the word up.
     */
    hasFlag(word, flag, wordFlags) {
      if (!this.loaded) {
        throw NOT_LOADED_ERROR;
      }
      const flagValue = this.flags[flag];
      if (flagValue === void 0 || flagValue === "") {
        return false;
      }
      if (wordFlags !== void 0) {
        const sets = typeof wordFlags === "string" ? [wordFlags] : wordFlags;
        return sets.some((set) => this.flagsInclude(set, flagValue));
      }
      const flagSets = this.dictionaryTable.get(word);
      if (!flagSets) {
        return false;
      }
      for (const set of flagSets) {
        if (this.flagsInclude(set, flagValue)) {
          return true;
        }
      }
      return false;
    }
    /* --------------------------------------------------------------------------------------------
     * Dictionary file parsing
     * ------------------------------------------------------------------------------------------ */
    /**
     * Parses a .dic file into a dictionary table. The table also becomes this instance's
     * dictionaryTable, and the pruning index is rebuilt for it.
     */
    _parseDIC(data) {
      const parse = this.parseDicGenerator(data);
      let step = parse.next();
      while (!step.done) {
        step = parse.next();
      }
      this.dictionaryTable = step.value;
      this.buildPruneIndex();
      return step.value;
    }
    *parseDicGenerator(data) {
      const table = /* @__PURE__ */ new Map();
      const lines = data.replace(/^\uFEFF/, "").split("\n");
      const compoundStartFlags = this.compoundStartFlags;
      const compoundEndFlags = this.compoundEndFlags;
      const compoundFlags = this.compoundFlags;
      const compoundStarts = this.compoundStarts = /* @__PURE__ */ new Set();
      const compoundSingleEnds = this.compoundSingleEnds = /* @__PURE__ */ new Set();
      const compoundChars = this.compoundChars = new Uint8Array(128);
      const compoundCharsHigh = this.compoundCharsHigh = /* @__PURE__ */ new Set();
      const hasCompounds = compoundFlags.size > 0;
      const hasAliases = this.flagAliases.length > 0;
      for (let i = 1; i < lines.length; i++) {
        if (i % ASYNC_PARSE_BATCH === 0) {
          yield;
        }
        let line = lines[i];
        if (!line || line.charCodeAt(0) === 9) {
          continue;
        }
        const space = firstWhitespace(line);
        if (space !== -1) {
          line = line.substring(0, space);
          if (!line) {
            continue;
          }
        }
        let word;
        let flags = "";
        const slash = line.indexOf("/");
        if (slash === -1) {
          word = line;
        } else if (line.indexOf("\\/") === -1) {
          word = line.substring(0, slash);
          flags = line.substring(slash + 1);
        } else {
          [word, flags] = this.splitFlagField(line).map((part) => part ?? "");
        }
        if (hasAliases && flags) {
          flags = this.resolveFlags(flags);
        }
        const existing = table.get(word);
        if (existing === void 0) {
          table.set(word, flags ? [flags] : null);
        } else if (flags) {
          if (existing === null) {
            table.set(word, ["", flags]);
          } else {
            existing.push(flags);
          }
        } else if (existing !== null && !existing.includes("")) {
          existing.push("");
        }
        if (flags && hasCompounds && word) {
          for (const flag of compoundFlags) {
            if (this.flagsInclude(flags, flag)) {
              for (let c = 0; c < word.length; c++) {
                const code = word.charCodeAt(c);
                if (code < 128) {
                  compoundChars[code] = 1;
                } else {
                  compoundCharsHigh.add(code);
                }
              }
              break;
            }
          }
          for (const flag of compoundStartFlags) {
            if (this.flagsInclude(flags, flag)) {
              compoundStarts.add(word[0]);
              break;
            }
          }
          if (word.length === 1) {
            for (const flag of compoundEndFlags) {
              if (this.flagsInclude(flags, flag)) {
                compoundSingleEnds.add(word);
                break;
              }
            }
          }
        }
      }
      return table;
    }
    /* --------------------------------------------------------------------------------------------
     * Checking
     * ------------------------------------------------------------------------------------------ */
    /**
     * Checks whether a word is spelled correctly. Surrounding whitespace is ignored, the
     * input conversion table (ICONV) is applied, and capitalization variants are tried.
     */
    check(word) {
      if (!this.loaded) {
        throw NOT_LOADED_ERROR;
      }
      if (!word) {
        return false;
      }
      const trimmed = word.trim();
      if (!trimmed) {
        return false;
      }
      return this.checkCaseVariants(this.applyConversion(trimmed, this.inputConversion));
    }
    /**
     * Checks a word and its capitalization variants exactly as given (no trimming or
     * input conversion).
     */
    checkCaseVariants(word) {
      if (!word) {
        return false;
      }
      if (this.acceptsExact(word)) {
        return true;
      }
      if (isAllUpperCase(word)) {
        const capitalized = word[0] + word.substring(1).toLowerCase();
        if (this.hasFlag(capitalized, "KEEPCASE")) {
          return false;
        }
        if (this.acceptsExact(capitalized)) {
          return true;
        }
        if (this.acceptsExact(word.toLowerCase())) {
          return true;
        }
      }
      if (hasUpperCaseInitial(word)) {
        const uncapitalized = word[0].toLowerCase() + word.substring(1);
        if (this.hasFlag(uncapitalized, "KEEPCASE")) {
          return false;
        }
        if (this.acceptsExact(uncapitalized)) {
          return true;
        }
      }
      return false;
    }
    /**
     * Checks whether a word, exactly as given, is a stem in the dictionary, an affixed
     * form of a stem, or a compound word allowed by the COMPOUNDRULE table.
     */
    checkExact(word) {
      if (!this.loaded) {
        throw NOT_LOADED_ERROR;
      }
      return !!word && this.acceptsExact(word);
    }
    acceptsExact(word) {
      if (!this.mayBeKnown(word)) {
        return false;
      }
      const depth = this.stemPrefixDepth(word);
      if (depth >= word.length && this.isAcceptedStem(word)) {
        return true;
      }
      if (this.hasSuffixedForm(word, EMPTY_FLAGS, false, depth)) {
        return true;
      }
      if (this.hasPrefixedForm(word, depth, this.suffixLookupTried)) {
        return true;
      }
      return this.compiledCompoundRules.length > 0 && this.isCompound(word);
    }
    /**
     * A quick test that rejects most words the dictionary cannot possibly accept: every
     * accepted word starts and ends with a pair of characters that occurs at the start or
     * end of some stem or affix (see buildPruneIndex()). Only ASCII pairs are tested.
     */
    mayBeKnown(word) {
      const length = word.length;
      if (length < 2) {
        return true;
      }
      if (this.pruneStart) {
        const first = word.charCodeAt(0);
        const second = word.charCodeAt(1);
        if (first < 128 && second < 128 && this.startWild[first] === 0) {
          const key = first << 7 | second;
          if ((this.startPairs[key >> 3] & 1 << (key & 7)) === 0) {
            return false;
          }
        }
      }
      const last = word.charCodeAt(length - 1);
      const beforeLast = word.charCodeAt(length - 2);
      if (last < 128 && beforeLast < 128 && this.endWild[last] === 0) {
        const key = beforeLast << 7 | last;
        if ((this.endPairs[key >> 3] & 1 << (key & 7)) === 0) {
          return false;
        }
      }
      return true;
    }
    /** Whether the word is listed in the dictionary as a word in its own right. */
    isAcceptedStem(word) {
      const flagSets = this.dictionaryTable.get(word);
      if (flagSets === void 0) {
        return false;
      }
      if (flagSets === null) {
        return true;
      }
      const flags = this.flags;
      const onlyInCompound = flags.ONLYINCOMPOUND;
      const needAffix = flags.NEEDAFFIX;
      const forbidden = flags.FORBIDDENWORD;
      for (let i = 0; i < flagSets.length; i++) {
        const set = flagSets[i];
        if (!set) {
          return true;
        }
        if (onlyInCompound && this.flagsInclude(set, onlyInCompound)) {
          continue;
        }
        if (needAffix && this.flagsInclude(set, needAffix)) {
          continue;
        }
        if (forbidden && this.flagsInclude(set, forbidden)) {
          continue;
        }
        return true;
      }
      return false;
    }
    /**
     * Whether one of a stem's flag sets contains a flag, plus any further required flags,
     * and is not a FORBIDDENWORD entry.
     */
    flagSetsHave(flagSets, flag, required = EMPTY_FLAGS) {
      const forbidden = this.flags.FORBIDDENWORD;
      for (let i = 0; i < flagSets.length; i++) {
        const set = flagSets[i];
        if (!set || !this.flagsInclude(set, flag)) {
          continue;
        }
        if (required.length > 0 && !this.flagsIncludeAll(set, required)) {
          continue;
        }
        if (forbidden && this.flagsInclude(set, forbidden)) {
          continue;
        }
        return true;
      }
      return false;
    }
    /**
     * Whether the word can be produced by adding one or two suffixes to a stem.
     *
     * @param word     The word (possibly with a prefix already stripped).
     * @param required Flags that the stem must carry unless a suffix carries them on as
     *                 continuation flags (e.g. the flag of a stripped prefix).
     * @param cross    Whether only cross-product suffixes may be used (set when a prefix
     *                 has been stripped).
     * @param depth    stemPrefixDepth(word).
     */
    hasSuffixedForm(word, required, cross, depth) {
      const length = word.length;
      let node = this.suffixTrie;
      this.suffixLookupTried = false;
      for (let stripped = 0; node !== void 0; stripped++) {
        const groups = node.groups;
        if (groups !== null) {
          const baseLength = length - stripped;
          const direct = baseLength <= depth;
          let base = null;
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            if (!direct && !group.continued) {
              continue;
            }
            if (base === null) {
              base = stripped === 0 ? word : word.substring(0, baseLength);
              this.suffixLookupTried = true;
            }
            const stem = group.strip ? base + group.strip : base;
            if (stem && this.suffixGroupMatches(group, stem, required, cross, direct, baseLength, depth)) {
              return true;
            }
          }
        }
        if (stripped === length || node.children === null) {
          break;
        }
        node = node.children.get(word.charCodeAt(length - 1 - stripped));
      }
      return false;
    }
    /**
     * Whether one of a group's suffixes, removed from the word, leaves a stem (or a suffixed stem).
     *
     * @param direct     Whether the stem itself may be in the dictionary (see hasSuffixedForm()).
     * @param baseLength How many characters of the stem come from the start of the word.
     * @param depth      stemPrefixDepth() of the word.
     */
    suffixGroupMatches(group, stem, required, cross, direct, baseLength, depth) {
      const flagSets = direct ? this.dictionaryTable.get(stem) : void 0;
      const entries = group.entries;
      for (let e = 0; e < entries.length; e++) {
        const entry = entries[e];
        const continuers = this.continuationIndex.get(entry.flag);
        if (flagSets === void 0 && continuers === void 0) {
          continue;
        }
        const rest = required.length === 0 ? EMPTY_FLAGS : this.flagsNotCarried(required, entry.continuation);
        if (cross && !entry.crossProduct && rest.length > 0) {
          continue;
        }
        if (entry.condition !== null && !entry.condition.test(stem)) {
          continue;
        }
        if (flagSets && this.flagSetsHave(flagSets, entry.flag, rest)) {
          return true;
        }
        if (continuers !== void 0 && this.hasContinuedForm(stem, rest, cross, continuers, baseLength, depth)) {
          return true;
        }
      }
      return false;
    }
    /**
     * Whether the (already suffix-stripped) word can be produced by one of the given
     * suffixes, all of which carry the stripped suffix's flag as a continuation flag.
     *
     * @param baseLength How many characters at the start of the word come from the start of
     *                   the word that is being checked.
     * @param depth      stemPrefixDepth() of the word that is being checked.
     */
    hasContinuedForm(word, required, cross, continuers, baseLength, depth) {
      const length = word.length;
      for (let i = 0; i < continuers.length; i++) {
        const entry = continuers[i];
        if (cross && !entry.crossProduct) {
          continue;
        }
        const addLength = entry.add.length;
        if (addLength > 0 && !word.endsWith(entry.add)) {
          continue;
        }
        if (Math.min(length - addLength, baseLength) > depth) {
          continue;
        }
        const stem = (addLength > 0 ? word.substring(0, length - addLength) : word) + entry.strip;
        if (!stem) {
          continue;
        }
        const flagSets = this.dictionaryTable.get(stem);
        if (!flagSets) {
          continue;
        }
        if (entry.condition !== null && !entry.condition.test(stem)) {
          continue;
        }
        const rest = required.length === 0 ? EMPTY_FLAGS : this.flagsNotCarried(required, entry.continuation);
        if (this.flagSetsHave(flagSets, entry.flag, rest)) {
          return true;
        }
      }
      return false;
    }
    /** The required flags that an affix's continuation flags do not supply. */
    flagsNotCarried(required, continuation) {
      if (!continuation) {
        return required;
      }
      let rest = null;
      for (let i = 0; i < required.length; i++) {
        const carried = this.flagsInclude(continuation, required[i]);
        if (rest === null && carried) {
          rest = required.slice(0, i);
        } else if (rest !== null && !carried) {
          rest.push(required[i]);
        }
      }
      return rest === null ? required : rest;
    }
    /**
     * Whether the word can be produced by adding a prefix, optionally plus suffixes, to a stem.
     *
     * @param depth         stemPrefixDepth(word).
     * @param suffixesTried Whether looking for a suffix on the word itself got as far as
     *                      looking a stem up.
     */
    hasPrefixedForm(word, depth, suffixesTried) {
      const length = word.length;
      let node = this.prefixTrie;
      for (let stripped = 0; node !== void 0; stripped++) {
        const groups = node.groups;
        if (groups !== null) {
          const base = stripped === 0 ? word : word.substring(stripped);
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const rest = group.strip ? group.strip + base : base;
            const unchanged = stripped === 0 && !group.strip;
            if (rest && this.prefixGroupMatches(group, rest, unchanged ? depth : this.stemPrefixDepth(rest), unchanged ? suffixesTried : true)) {
              return true;
            }
          }
        }
        if (stripped === length || node.children === null) {
          break;
        }
        node = node.children.get(word.charCodeAt(stripped));
      }
      return false;
    }
    /**
     * Whether one of a group's prefixes, removed from the word, leaves a stem (or a suffixed stem).
     *
     * @param rest          The word without the prefix.
     * @param depth         stemPrefixDepth(rest).
     * @param suffixesTried False if it is already known that no suffix on `rest` is worth
     *                      looking a stem up for, which rules out every suffixed form.
     */
    prefixGroupMatches(group, rest, depth, suffixesTried) {
      const flagSets = depth >= rest.length ? this.dictionaryTable.get(rest) : void 0;
      const entries = group.entries;
      let requiredFlags = null;
      for (let e = 0; e < entries.length; e++) {
        const entry = entries[e];
        if (entry.condition !== null && !entry.condition.test(rest)) {
          continue;
        }
        if (flagSets && this.flagSetsHave(flagSets, entry.flag)) {
          return true;
        }
        if (!suffixesTried) {
          continue;
        }
        if (entry.crossProduct) {
          if (requiredFlags === null || requiredFlags[0] !== entry.flag) {
            requiredFlags = [entry.flag];
          }
          if (this.hasSuffixedForm(rest, requiredFlags, true, depth)) {
            return true;
          }
        }
        if (entry.continuation && this.hasSuffixGrantedByPrefix(rest, entry, depth)) {
          return true;
        }
      }
      return false;
    }
    /**
     * Whether the word (with a prefix already stripped) is a stem that takes the prefix,
     * plus a suffix named by the prefix's continuation flags.
     */
    hasSuffixGrantedByPrefix(word, prefix, depth) {
      const length = word.length;
      let node = this.suffixTrie;
      for (let stripped = 0; node !== void 0; stripped++) {
        const groups = node.groups;
        if (groups !== null && length - stripped <= depth) {
          const base = stripped === 0 ? word : word.substring(0, length - stripped);
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const stem = group.strip ? base + group.strip : base;
            const flagSets = stem ? this.dictionaryTable.get(stem) : void 0;
            if (!flagSets || !this.flagSetsHave(flagSets, prefix.flag)) {
              continue;
            }
            for (let e = 0; e < group.entries.length; e++) {
              const suffix = group.entries[e];
              if (this.flagsInclude(prefix.continuation, suffix.flag) && (suffix.condition === null || suffix.condition.test(stem))) {
                return true;
              }
            }
          }
        }
        if (stripped === length || node.children === null) {
          break;
        }
        node = node.children.get(word.charCodeAt(length - 1 - stripped));
      }
      return false;
    }
    /** Whether the word matches one of the COMPOUNDRULE patterns. */
    isCompound(word) {
      if (!this.compoundStarts.has(word[0])) {
        return false;
      }
      for (let i = 0; i < word.length; i++) {
        const code = word.charCodeAt(i);
        if (code < 128 ? this.compoundChars[code] === 0 : !this.compoundCharsHigh.has(code)) {
          return false;
        }
      }
      const minimum = this.flags.COMPOUNDMIN !== void 0 ? parseInt(this.flags.COMPOUNDMIN, 10) || 1 : DEFAULT_COMPOUND_MIN;
      if (word.length < minimum * 2) {
        return false;
      }
      for (const rule of this.compiledCompoundRules) {
        if (this.matchesCompoundRule(rule, word, minimum)) {
          return true;
        }
      }
      return false;
    }
    matchesCompoundRule(rule, word, minimum) {
      const items = rule.items;
      const length = word.length;
      const failed = /* @__PURE__ */ new Set();
      const partHasFlag = (start, end, flag) => {
        const flagSets = this.dictionaryTable.get(word.substring(start, end));
        if (!flagSets) {
          return false;
        }
        for (const flags of flagSets) {
          if (this.flagsInclude(flags, flag)) {
            return true;
          }
        }
        return false;
      };
      const match = (index, position, parts) => {
        if (index === items.length) {
          return position === length && parts >= 2;
        }
        const key = (index * (length + 1) + position) * 2 + (parts >= 2 ? 1 : 0);
        if (failed.has(key)) {
          return false;
        }
        const item = items[index];
        if (item.optional && match(index + 1, position, parts)) {
          return true;
        }
        for (let end = position + minimum; end <= length; end++) {
          if (partHasFlag(position, end, item.flag)) {
            if (match(item.repeatable ? index : index + 1, end, parts + 1)) {
              return true;
            }
          }
        }
        failed.add(key);
        return false;
      };
      return match(0, 0, 0);
    }
    /* --------------------------------------------------------------------------------------------
     * Pruning index
     * ------------------------------------------------------------------------------------------ */
    /**
     * Records every prefix of every stem in a Bloom filter, so that stemPrefixDepth() can
     * tell how much of the start of a word could be the start of a stem.
     *
     * suggest() checks a very large number of strings that are not words. Removing a suffix
     * from one of them leaves the start of a stem, and each stem that could be has to be
     * looked up; in a dictionary with many suffixes that is many lookups for every string.
     * Most of those strings stop looking like any stem after a few characters, which rules
     * the lookups out without making them.
     *
     * The filter is only built when suggest() first needs it; without it, every lookup is made.
     */
    buildStemPrefixIndex() {
      let prefixes = 0;
      for (const stem of this.dictionaryTable.keys()) {
        prefixes += stem.length;
      }
      let size = 1 << 16;
      while (size < prefixes * 8 && size < 1 << 30) {
        size <<= 1;
      }
      const bits = new Uint8Array(size >> 3);
      const mask = size - 1;
      for (const stem of this.dictionaryTable.keys()) {
        let hash = 0;
        for (let i = 0; i < stem.length; i++) {
          hash = Math.imul(hash ^ stem.charCodeAt(i), 16777619) + 2654435769 | 0;
          const first = hash & mask;
          const second = Math.imul(hash, 2246822507) >>> 7 & mask;
          bits[first >> 3] |= 1 << (first & 7);
          bits[second >> 3] |= 1 << (second & 7);
        }
      }
      this.stemPrefixBits = bits;
      this.stemPrefixMask = mask;
    }
    /**
     * How many characters at the start of the word are (almost certainly) the start of some
     * stem. A longer start of the word is definitely not the start of any stem. Without the
     * filter from buildStemPrefixIndex(), this is the length of the word, which rules nothing out.
     */
    stemPrefixDepth(word) {
      const bits = this.stemPrefixBits;
      const length = word.length;
      if (bits === null) {
        return length;
      }
      const mask = this.stemPrefixMask;
      let hash = 0;
      for (let i = 0; i < length; i++) {
        hash = Math.imul(hash ^ word.charCodeAt(i), 16777619) + 2654435769 | 0;
        const first = hash & mask;
        if ((bits[first >> 3] & 1 << (first & 7)) === 0) {
          return i;
        }
        const second = Math.imul(hash, 2246822507) >>> 7 & mask;
        if ((bits[second >> 3] & 1 << (second & 7)) === 0) {
          return i;
        }
      }
      return length;
    }
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
    buildPruneIndex() {
      const startPairs = this.startPairs = new Uint8Array(2048);
      const endPairs = this.endPairs = new Uint8Array(2048);
      const startWild = this.startWild = new Uint8Array(128);
      const endWild = this.endWild = new Uint8Array(128);
      const table = this.dictionaryTable;
      let pruneStart = true;
      const wild = (bitmap, text) => {
        const code = text.charCodeAt(0);
        if (code < 128) {
          bitmap[code] = 1;
          bitmap[asciiUpper(code)] = 1;
        }
      };
      const suffixGroupsByStrip = /* @__PURE__ */ new Map();
      const prefixGroupsByStrip = /* @__PURE__ */ new Map();
      const stripOnlyGroups = [];
      for (const group of this.suffixGroups) {
        const add = group.add;
        if (add.length >= 2) {
          addPair(endPairs, add.charCodeAt(add.length - 2), add.charCodeAt(add.length - 1));
          if (group.strip && table.has(group.strip)) {
            addPair(startPairs, add.charCodeAt(0), add.charCodeAt(1));
          }
        } else if (add.length === 1) {
          wild(endWild, add);
        } else if (group.strip.length > 0) {
          stripOnlyGroups.push(group);
        }
        if (add.length > 0) {
          let groups = suffixGroupsByStrip.get(group.strip);
          if (!groups) {
            suffixGroupsByStrip.set(group.strip, groups = []);
          }
          groups.push(group);
        }
      }
      for (const group of this.prefixGroups) {
        const add = group.add;
        if (add.length >= 2) {
          addPair(startPairs, add.charCodeAt(0), add.charCodeAt(1));
        } else if (add.length === 1) {
          wild(startWild, add);
        } else if (group.strip.length > 0) {
          pruneStart = false;
        }
        if (add.length > 0) {
          let groups = prefixGroupsByStrip.get(group.strip);
          if (!groups) {
            prefixGroupsByStrip.set(group.strip, groups = []);
          }
          groups.push(group);
        }
      }
      const takesGroup = (flagSets, group, stem) => {
        for (const entry of group.entries) {
          if (this.flagSetsHave(flagSets, entry.flag) && (entry.condition === null || entry.condition.test(stem))) {
            return true;
          }
        }
        return false;
      };
      const recordCore = (core) => {
        if (core.length >= 2) {
          addPair(endPairs, core.charCodeAt(core.length - 2), core.charCodeAt(core.length - 1));
          return;
        }
        for (const group of this.prefixGroups) {
          if (group.add.length > 0) {
            addPair(endPairs, group.add.charCodeAt(group.add.length - 1), core.charCodeAt(0));
          }
        }
        for (const group of this.suffixGroups) {
          if (group.add.length > 0) {
            addPair(startPairs, core.charCodeAt(0), group.add.charCodeAt(0));
          }
        }
      };
      const firstChars = /* @__PURE__ */ new Set();
      const lastChars = /* @__PURE__ */ new Set();
      table.forEach((flagSets, stem) => {
        const length = stem.length;
        if (length >= 2) {
          addPair(startPairs, stem.charCodeAt(0), stem.charCodeAt(1));
          addPair(endPairs, stem.charCodeAt(length - 2), stem.charCodeAt(length - 1));
        }
        if (!flagSets) {
          return;
        }
        firstChars.add(stem[0]);
        lastChars.add(stem[length - 1]);
        for (let i = 0; i < stripOnlyGroups.length; i++) {
          const group = stripOnlyGroups[i];
          if (length > group.strip.length && stem.endsWith(group.strip) && takesGroup(flagSets, group, stem)) {
            const core = stem.substring(0, length - group.strip.length);
            recordCore(core);
            for (const second of stripOnlyGroups) {
              if (core.length > second.strip.length && core.endsWith(second.strip)) {
                recordCore(core.substring(0, core.length - second.strip.length));
              }
            }
          }
        }
      });
      for (const [strip, groups] of suffixGroupsByStrip) {
        for (const first of firstChars) {
          const stem = first + strip;
          const flagSets = table.get(stem);
          if (!flagSets) {
            continue;
          }
          for (const group of groups) {
            if (takesGroup(flagSets, group, stem)) {
              addPair(startPairs, stem.charCodeAt(0), group.add.charCodeAt(0));
            }
          }
        }
      }
      for (const [strip, groups] of prefixGroupsByStrip) {
        for (const last of lastChars) {
          const stem = strip + last;
          const flagSets = table.get(stem);
          if (!flagSets) {
            continue;
          }
          for (const group of groups) {
            if (takesGroup(flagSets, group, stem)) {
              addPair(endPairs, group.add.charCodeAt(group.add.length - 1), stem.charCodeAt(stem.length - 1));
            }
          }
        }
      }
      for (const start of this.compoundStarts) {
        wild(startWild, start);
      }
      for (const end of this.compoundSingleEnds) {
        wild(endWild, end);
      }
      this.pruneStart = pruneStart;
      this.stemPrefixBits = null;
    }
    /* --------------------------------------------------------------------------------------------
     * Suggestions
     * ------------------------------------------------------------------------------------------ */
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
    suggest(word, limit) {
      if (!this.loaded) {
        throw NOT_LOADED_ERROR;
      }
      limit = limit || DEFAULT_SUGGESTION_LIMIT;
      const cached = this.memoized[word];
      if (cached !== void 0 && (limit <= cached.limit || cached.suggestions.length < cached.limit)) {
        return cached.suggestions.slice(0, limit);
      }
      if (this.check(word)) {
        return [];
      }
      const converted = this.applyConversion(word, this.inputConversion);
      if (!converted) {
        return [];
      }
      let suggestions = this.suggestFromReplacements(converted);
      if (suggestions === null) {
        const mapped = this.suggestFromMap(converted);
        suggestions = mapped.length >= limit ? mapped.slice(0, limit) : [.../* @__PURE__ */ new Set([...mapped, ...this.suggestFromEdits(converted, limit)])].slice(0, limit);
      }
      this.memoized[word] = { suggestions, limit };
      return suggestions.slice();
    }
    /** Applies the output conversion table (OCONV) to suggestions, dropping duplicates. */
    convertOutput(suggestions) {
      if (!this.outputConversion) {
        return suggestions;
      }
      return [...new Set(suggestions.map((suggestion) => this.applyConversion(suggestion, this.outputConversion)))];
    }
    /**
     * The REP table: the first replacement that produces a known word is the suggestion.
     * "^" at the start of a misspelling and "$" at its end tie it to the start or end of the word.
     */
    suggestFromReplacements(word) {
      for (const [pattern, to] of this.replacementTable) {
        const atStart = pattern.length > 1 && pattern[0] === "^";
        const atEnd = pattern.length > (atStart ? 2 : 1) && pattern[pattern.length - 1] === "$";
        const from = pattern.substring(atStart ? 1 : 0, atEnd ? pattern.length - 1 : pattern.length);
        let position;
        if (atStart) {
          position = word.startsWith(from) && (!atEnd || word.length === from.length) ? 0 : -1;
        } else if (atEnd) {
          position = word.endsWith(from) ? word.length - from.length : -1;
        } else {
          position = word.indexOf(from);
        }
        if (position === -1) {
          continue;
        }
        const corrected = word.substring(0, position) + to + word.substring(position + from.length);
        if (this.checkCaseVariants(corrected)) {
          return this.convertOutput([corrected]);
        }
      }
      return null;
    }
    /**
     * The MAP table: known words made by swapping characters of the word for related ones
     * (typically accented forms of the same letter). Words that need fewer swaps come first.
     */
    suggestFromMap(word) {
      const table = this.mapTable;
      if (table.length === 0) {
        return [];
      }
      const options = [];
      let any = false;
      for (let i = 0; i < word.length; i++) {
        const here = [];
        for (const group of table) {
          for (const item of group) {
            if (word.startsWith(item, i)) {
              const upper = item !== item.toLowerCase();
              const alternatives = group.filter((other) => other !== item && other !== other.toLowerCase() === upper);
              if (alternatives.length > 0) {
                here.push({ length: item.length, alternatives });
                any = true;
              }
            }
          }
        }
        options.push(here);
      }
      if (!any) {
        return [];
      }
      const found = [];
      let tried = 0;
      const visit = (start, prefix, swaps, level) => {
        for (let i = start; i < word.length; i++) {
          for (const option of options[i]) {
            for (const alternative of option.alternatives) {
              if (tried >= MAP_MAX_CANDIDATES) {
                return;
              }
              const head = prefix + word.substring(start, i) + alternative;
              if (swaps + 1 < level) {
                visit(i + option.length, head, swaps + 1, level);
                continue;
              }
              const candidate = head + word.substring(i + option.length);
              tried++;
              if (!found.includes(candidate) && this.checkCaseVariants(candidate) && !this.hasFlag(candidate, "NOSUGGEST")) {
                found.push(candidate);
              }
            }
          }
        }
      };
      for (let level = 1; level <= MAP_MAX_SUBSTITUTIONS && tried < MAP_MAX_CANDIDATES; level++) {
        visit(0, "", 0, level);
      }
      return this.convertOutput(found);
    }
    ensureAlphabet() {
      if (this.alphabetLetters.length > 0 && this.alphabet) {
        return;
      }
      let letters = DEFAULT_ALPHABET;
      if (this.flags.TRY) {
        letters += this.flags.TRY;
      }
      if (this.flags.WORDCHARS) {
        letters += this.flags.WORDCHARS;
      }
      this.alphabetLetters = [...new Set(letters.split(""))].sort();
      this.alphabetUpper = this.alphabetLetters.map((letter) => letter.toUpperCase());
      this.alphabet = this.alphabetLetters.join("");
    }
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
    forEachEdit(word, visit) {
      const letters = this.alphabetLetters;
      const upperLetters = this.alphabetUpper;
      const letterCount = letters.length;
      for (let i = 0; i < word.length; i++) {
        const head = word.substring(0, i);
        const tail = word.substring(i);
        const first = tail[0];
        const rest = tail.substring(1);
        visit(head + rest);
        if (tail.length > 1 && tail[1] !== first) {
          visit(head + tail[1] + first + tail.substring(2));
        }
        const upper = first.toUpperCase() === first;
        const replacements = upper ? upperLetters : letters;
        for (let j = 0; j < letterCount; j++) {
          if (replacements[j] !== first) {
            visit(head + replacements[j] + rest);
          }
        }
        const insertions = upper && head.toUpperCase() === head ? upperLetters : letters;
        for (let j = 0; j < letterCount; j++) {
          visit(head + insertions[j] + tail);
        }
      }
    }
    suggestFromEdits(word, limit) {
      this.ensureAlphabet();
      if (this.stemPrefixBits === null) {
        this.buildStemPrefixIndex();
      }
      const knownCache = /* @__PURE__ */ new Map();
      const isKnown = (candidate) => {
        if (!this.mayBeKnown(candidate)) {
          return false;
        }
        let known = knownCache.get(candidate);
        if (known === void 0) {
          known = this.checkCaseVariants(candidate);
          knownCache.set(candidate, known);
        }
        return known;
      };
      const oneEdit = /* @__PURE__ */ new Map();
      this.forEachEdit(word, (edit) => {
        oneEdit.set(edit, (oneEdit.get(edit) ?? 0) + 1);
      });
      const weights = /* @__PURE__ */ new Map();
      for (const edit of oneEdit.keys()) {
        this.forEachEdit(edit, (candidate) => {
          if (isKnown(candidate)) {
            weights.set(candidate, (weights.get(candidate) ?? 0) + 1);
          }
        });
      }
      for (const [edit, count] of oneEdit) {
        if (isKnown(edit)) {
          weights.set(edit, (weights.get(edit) ?? 0) + count);
        }
      }
      const ranked = [];
      for (const [candidate, weight] of weights) {
        ranked.push([candidate, this.hasFlag(candidate, "PRIORITYSUGGEST") ? weight + PRIORITY_SUGGESTION_BONUS : weight]);
      }
      const collator = this.collator;
      ranked.sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
      const scheme = word.toUpperCase() === word ? "uppercase" : word[0].toUpperCase() + word.substring(1).toLowerCase() === word ? "capitalized" : "lowercase";
      const suggestions = [];
      for (let i = 0; i < ranked.length && suggestions.length < limit; i++) {
        const candidate = ranked[i][0];
        let suggestion = candidate;
        if (scheme === "uppercase") {
          suggestion = candidate.toUpperCase();
        } else if (scheme === "capitalized") {
          suggestion = candidate[0].toUpperCase() + candidate.substring(1);
        }
        if (this.hasFlag(candidate, "NOSUGGEST") || this.hasFlag(suggestion, "NOSUGGEST")) {
          continue;
        }
        if (!suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
      return this.convertOutput(suggestions);
    }
  };
  var typo_default = Typo;
  return __toCommonJS(typo_exports);
})();
Typo = Typo.default; if (typeof module !== 'undefined') { module.exports = Typo; module.exports.Typo = Typo; module.exports.default = Typo; }
