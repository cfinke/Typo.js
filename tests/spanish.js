function run() {
	var utilityDict = new Typo();
	var affData = utilityDict._readFile(chrome.extension.getURL("tests/dictionaries/es/es.aff"), "UTF-8");
	var wordData = utilityDict._readFile(chrome.extension.getURL("tests/dictionaries/es/es.dic"), "UTF-8");
	
	var hashDict = new Typo("es", affData, wordData);
	testDictionary(hashDict);
	
	var dict = new Typo("es", null, null, { dictionaryPath : "tests/dictionaries", asyncLoad : true, loadedCallback : function () {
		testDictionary(dict);
	}});
}

function testDictionary(dict) {
	test("Dictionary object attributes are properly set", function () {
		equal(dict.dictionary, "es");
	});
}

addEventListener( "load", run, false );