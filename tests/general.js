function run() {
	// Determine runtime for cross-browser compatibility
	const runtime = window.browser ? browser.runtime : chrome.runtime;

	var empty_dict = new Typo();

	test("Dictionary instantiated without arguments is essentially empty.", function () {
		deepEqual(empty_dict.rules, {});
		deepEqual(empty_dict.dictionaryTable, new Map());
		deepEqual(empty_dict.dictionary, null);
	});

	test("Comments are removed from affix file lines", function () {
		equal(empty_dict._removeAffixComments("# abc"), "", "Comment-only lines are removed.");
		equal(empty_dict._removeAffixComments("def # ghi"), "def # ghi", "Lines that don't begin with comments are not modified");
		equal(empty_dict._removeAffixComments(" # jkl"), "", "Comment-only lines beginning with whitespace are removed.");
		equal(empty_dict._removeAffixComments("mnop qrst"), "mnop qrst", "Lines with no comments are not modified.");
		equal(empty_dict._removeAffixComments("##"), "", "Comment-only lines are removed.");
		equal(empty_dict._removeAffixComments(""), "", "Empty lines are not modified.");
		equal(empty_dict._removeAffixComments("abc"), "abc", "Handles input that doesn't need changing.");
	});

	test("_readFile can load a file synchronously", function() {
		var data = empty_dict._readFile(chrome.runtime.getURL("../typo/dictionaries/en_US/en_US.dic"));
		ok(data && data.length > 0);
	});

	asyncTest("_readFile can load a file asynchronously", function(assert) {
		empty_dict._readFile(chrome.runtime.getURL("../typo/dictionaries/en_US/en_US.dic"), null, true).then(function(data) {
			assert.ok(data && data.length > 0);
			QUnit.start();
		}, function(err) {
			QUnit.pushFailure(err);
			QUnit.start();
		});
	});

	function checkLoadedDict(dict) {
		ok(dict);
		ok(dict.compoundRules.length > 0);
		ok(dict.replacementTable.length > 0);
	}

	test("Dictionary instantiated with preloaded data is setup correctly", function() {
		var affData = empty_dict._readFile(chrome.runtime.getURL("../typo/dictionaries/en_US/en_US.aff"));
		var wordData = empty_dict._readFile(chrome.runtime.getURL("../typo/dictionaries/en_US/en_US.dic"));
		var dict = new Typo("en_US", affData, wordData);
		checkLoadedDict(dict);
	});

	test("Synchronous load of dictionary data", function() {
		var dict = new Typo("en_US");
		checkLoadedDict(dict);
	});

	asyncTest("Asynchronous load of dictionary data", function() {
		var dict = new Typo("en_US", null, null, { asyncLoad: true, loadedCallback: function() {
			checkLoadedDict(dict);
			QUnit.start();
		}});
	});

	asyncTest("Typo.load resolves with a loaded dictionary", function(assert) {
		Typo.load("en_US").then(function(dict) {
			checkLoadedDict(dict);
			assert.ok(dict.loaded);
			assert.equal(dict.dictionary, "en_US");
			assert.ok(dict.check("hello"));
			QUnit.start();
		}, function(err) {
			QUnit.pushFailure(err);
			QUnit.start();
		});
	});

	asyncTest("Typo.load rejects when the dictionary can't be loaded", function(assert) {
		Typo.load("xx_XX").then(function() {
			QUnit.pushFailure("Loading a dictionary that doesn't exist should fail.");
			QUnit.start();
		}, function(err) {
			assert.ok(err, "The promise is rejected with an error.");
			QUnit.start();
		});
	});

	test("A FLAG directive passed through settings is honored", function() {
		var affData = "SFX Bb Y 1\nSFX Bb 0 s .\nSFX aB Y 1\nSFX aB 0 x .";
		var dict = new Typo("xx", affData, "1\nword/AaBb", { flags: { FLAG: "long" } });

		ok(dict.check("word"));
		ok(dict.check("words"), "The flags are read two characters at a time, so the word has the Bb flag.");
		ok(!dict.check("wordx"), "The word doesn't have the aB flag, which only exists across two flags.");
	});

	test("A flag can name both a prefix rule and a suffix rule", function() {
		var affData = "PFX O Y 1\nPFX O 0 non- .\nSFX O Y 1\nSFX O 0 al .";
		var dict = new Typo("xx", affData, "1\naberration/O");

		ok(dict.check("aberration"));
		ok(dict.check("aberrational"), "The suffix rule applies.");
		ok(dict.check("non-aberration"), "The prefix rule applies.");
		ok(dict.check("non-aberrational"), "Both rules apply together.");
		ok(!dict.check("alaberration"), "The suffix is not applied as a prefix.");
		ok(!dict.check("aberrationnon-"), "The prefix is not applied as a suffix.");
	});

	test("A prefix's continuation flags allow suffixes that the stem isn't flagged with", function() {
		var affData = "PFX U Y 2\nPFX U 0 0/S .\nPFX U 0 kilo/S .\nSFX S Y 1\nSFX S 0 s .";
		var dict = new Typo("xx", affData, "2\nwatt/U\nvolt");

		ok(dict.check("watt"));
		ok(dict.check("kilowatt"));
		ok(dict.check("watts"), "The empty prefix carries the suffix flag.");
		ok(dict.check("kilowatts"), "The prefix carries the suffix flag.");
		ok(!dict.check("volts"), "A stem without the prefix flag doesn't get the suffix.");
		ok(!dict.check("kilovolts"));
	});

	test("A suffix that doesn't combine with prefixes still takes a prefix named by its continuation flags", function() {
		var affData = "PFX N Y 1\nPFX N 0 n' .\nSFX V N 2\nSFX V er e/N er\nSFX V er ant er";
		var dict = new Typo("xx", affData, "1\nurger/V");

		ok(dict.check("urge"));
		ok(dict.check("n'urge"), "The suffix names the prefix in its continuation flags.");
		ok(dict.check("urgant"));
		ok(!dict.check("n'urgant"), "This suffix doesn't name the prefix.");
		ok(!dict.check("n'urger"), "The stem isn't flagged with the prefix.");
	});

	test("Changing an array returned by suggest() doesn't change later results", function() {
		var dict = new Typo("en_US");
		var first = dict.suggest("speling");
		var expected = first.slice();

		ok(expected.length > 0);
		first.length = 0;
		deepEqual(dict.suggest("speling"), expected, "A result that was emptied by the caller is returned intact the next time.");

		dict.suggest("speling").push("changed");
		deepEqual(dict.suggest("speling"), expected, "A cached result that was changed by the caller is returned intact the next time.");
	});

	test("Public API throws exception if called before dictionary is loaded", function() {
		var expected = function(err) {
			return err === "Dictionary not loaded.";
		};

		throws(empty_dict.check, expected);
		throws(empty_dict.checkExact, expected);
		throws(empty_dict.hasFlag, expected);
		throws(empty_dict.check, expected);
	});

	// https://github.com/cfinke/Typo.js/issues/97
	test("Suggesting a word named after an Object.prototype property doesn't break later suggestions", function() {
		var dict = new Typo("en_US");
		var expected = dict.suggest("mispeling");

		ok(expected.length > 0, "The misspelling has suggestions to compare against.");

		var words = ["hasOwnProperty", "constructor", "toString", "valueOf", "__proto__"];

		for (var i = 0; i < words.length; i++) {
			var first = dict.suggest(words[i]);

			ok(Array.isArray(first), "suggest('" + words[i] + "') returns an array.");
			deepEqual(dict.suggest(words[i]), first, "suggest('" + words[i] + "') returns the same result when repeated.");
			deepEqual(dict.suggest("mispeling"), expected, "suggest() still works after suggest('" + words[i] + "').");
		}
	});
}

addEventListener("load", run, false);
