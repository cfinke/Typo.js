function run() {
	var utilityDict = new Typo();
	var affData = utilityDict._readFile(chrome.runtime.getURL("tests/dictionaries/la/la.aff"));
	var wordData = utilityDict._readFile(chrome.runtime.getURL("tests/dictionaries/la/la.dic"));
	
	var hashDict = new Typo("la", affData, wordData, "hash");
	testDictionary(hashDict);
	
	var dict = new Typo("la", null, null, { dictionaryPath : "tests/dictionaries", asyncLoad : true, loadedCallback : function () {
		testDictionary(dict);
	}});
}

function testDictionary(dict) {
	test("Dictionary object attributes are properly set", function () {
		equal(dict.dictionary, "la");
	});
	
	test("Correct checking of words with no affixes", function () {
		equal(dict.check("firmiter"), true);
		equal(dict.check("quaequam"), true);
		equal(dict.check("quantarumcumque"), true);
	});
	
	test("Correct checking of root words with single affixes (affixes not used)", function () {
		equal(dict.check("pertransiveris"), true);
		equal(dict.check("saxum"), true);
		equal(dict.check("sepulchrum"), true);
		equal(dict.check("terra"), true);
	});

	test("Correct checking of root words with single affixes rules that can be applied multiple times", function () {
		equal(dict.check("pertransiverisque"), true);
		equal(dict.check("pertransiverisne"), true);
		equal(dict.check("pertransiverisve"), true);
	});
	
	test("Correct checking of root words with single affixes (affixes used)", function () {
		equal(dict.check("pertransiverisque"), true);
		equal(dict.check("saxi"), true);
		equal(dict.check("sepulchra"), true);
		equal(dict.check("terrae"), true);
	});

	test("Words not in the dictionary in any form are marked as misspelled.", function () {
		equal(dict.check("labhfblhbf"), false);
		equal(dict.check("weluhf73"), false);
		equal(dict.check("nxnxnxnxn"), false);
		equal(dict.check("saxiii"), false);
	});
	
	test("Leading and trailing whitespace is ignored.", function () {
		equal(dict.check("saxi "), true);
		equal(dict.check(" saxi"), true);
		equal(dict.check("  saxi"), true);
		equal(dict.check("saxi  "), true);
		equal(dict.check("  saxi  "), true);
	});
	
	test("Ligatures are expanded via the ICONV table before checking.", function () {
		equal(dict.check("TERRAE"), true);
		equal(dict.check("TERR\u00C6"), true);
		equal(dict.check("terr\u00E6"), true);
		equal(dict.check("Terr\u00E6"), true);
		equal(dict.check("TERR\u00C6X"), false);
		equal(dict.checkExact("terr\u00E6"), false);
	});
}

addEventListener( "load", run, false );