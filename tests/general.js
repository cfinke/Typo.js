function run() {
	var empty_dict = new Typo();
	
	test("Dictionary instantiated without arguments is essentially empty.", function () {
		deepEqual(empty_dict.rules, {});
		deepEqual(empty_dict.dictionaryTable, {});
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
		var data = empty_dict._readFile(chrome.extension.getURL("../typo/dictionaries/en_US/en_US.dic"));
		ok(data && data.length > 0);
	});
	
	asyncTest("_readFile can load a file asynchronously", function(assert) {
		empty_dict._readFile(chrome.extension.getURL("../typo/dictionaries/en_US/en_US.dic"), null, true).then(function(data) {
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
		var affData = empty_dict._readFile(chrome.extension.getURL("../typo/dictionaries/en_US/en_US.aff"));
		var wordData = empty_dict._readFile(chrome.extension.getURL("../typo/dictionaries/en_US/en_US.dic"));
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
	
	test("Public API throws exception if called before dictionary is loaded", function() {
		var expected = function(err) {
			return err === "Dictionary not loaded.";
		};
		
		throws(empty_dict.check, expected);
		throws(empty_dict.checkExact, expected);
		throws(empty_dict.hasFlag, expected);
		throws(empty_dict.check, expected);
	});
}

addEventListener( "load", run, false );