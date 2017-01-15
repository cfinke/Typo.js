function run() {
	var utilityDict = new Typo();
	var affData = utilityDict._readFile(chrome.extension.getURL("tests/dictionaries/en_GB/en_GB.aff"));
	var wordData = utilityDict._readFile(chrome.extension.getURL("tests/dictionaries/en_GB/en_GB.dic"));
	
	var hashDict = new Typo("en_GB", affData, wordData);
	
	testDictionary(hashDict);

	var dict = new Typo("en_GB", null, null, { dictionaryPath : "tests/dictionaries", asyncLoad : true, loadedCallback : function () {
		testDictionary(dict);
	}});
}

function testDictionary(dict) {
	test("Dictionary object attributes are properly set", function () {
		equal(dict.dictionary, "en_GB");
	});
	
	test("Correct checking of words", function () {
		equal(dict.check("wefwef"), false);
	});
}

addEventListener( "load", run, false );