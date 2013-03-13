function run() {
	var utilityDict = new Typo();
	var affData = utilityDict._readFile(chrome.extension.getURL("tests/dictionaries/de_DE/de_DE.aff"), "ISO8859-1");
	var wordData = utilityDict._readFile(chrome.extension.getURL("tests/dictionaries/de_DE/de_DE.dic"), "ISO8859-1");
	
	var hashDict = new Typo("de_DE", affData, wordData);
	testDictionary(hashDict);
}

function testDictionary(dict) {
	test("Dictionary object attributes are properly set", function () {
		equal(dict.dictionary, "de_DE");
	});
	
	test("Capitalization is respected", function typo_german_capitalization() {
		equal(dict.check("Liebe"), true);
		equal(dict.check("LIEBE"), true);
		
		// liebe is flagged with ONLYINCOMPOUND, but lieb has a suffix rule that generates liebe
		equal(dict.check("liebe"), true);
	});
	
	test("Issue #21", function typo_german_issue_21() {
		equal(dict.check("paar"), true);
	});
}

addEventListener( "load", run, false );