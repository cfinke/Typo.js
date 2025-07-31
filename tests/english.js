function run() {
	var utilityDict = new Typo();
	var affData = utilityDict._readFile(chrome.runtime.getURL("../typo/dictionaries/en_US/en_US.aff"));
	var wordData = utilityDict._readFile(chrome.runtime.getURL("../typo/dictionaries/en_US/en_US.dic"));

	var hashDict = new Typo("en_US", affData, wordData);

	testDictionary(hashDict);

	var dict = new Typo("en_US", null, null, { dictionaryPath : "../typo/dictionaries", asyncLoad : true, loadedCallback : function () {
		testDictionary(dict);
	}});
}

function testDictionary(dict) {
	test("Dictionary object attributes are properly set", function () {
		equal(dict.dictionary, "en_US");
	});

	test("Suggestions", function () {
		deepEqual(dict.suggest("speling", 3), [ "spelling", "spieling", "spewing" ]);

		// Repeated calls function properly.
		deepEqual(dict.suggest("speling", 1), [ "spelling" ]);
		deepEqual(dict.suggest("speling"), [ "spelling", "spieling", "spewing", "peeling", "selling" ]);
		deepEqual(dict.suggest("speling", 2), [ "spelling", "spieling" ]);
		deepEqual(dict.suggest("speling"), [ "spelling", "spieling", "spewing", "peeling", "selling" ]);

		// Requesting more suggestions than will be returned doesn't break anything.
		deepEqual(dict.suggest("spartang", 50),
			[
			  "spartan",
			  "sparing",
			  "parting",
			  "smarting",
			  "sparking",
			  "sparring",
			  "Spartan",
			  "Spartans",
			  "spatting",
			  "sporting",
			  "sprang",
			  "spurting",
			  "starting"
			]
		);
		deepEqual(dict.suggest("spartang", 30),
			[
			  "spartan",
			  "sparing",
			  "parting",
			  "smarting",
			  "sparking",
			  "sparring",
			  "Spartan",
			  "Spartans",
			  "spatting",
			  "sporting",
			  "sprang",
			  "spurting",
			  "starting"
			]
		);
		deepEqual(dict.suggest("spartang", 1), [ "spartan" ]);

		deepEqual(dict.suggest("spitting"), [ ], "Correctly spelled words receive no suggestions.");
		deepEqual(dict.suggest("spitting"), [ ], "Correctly spelled words receive no suggestions.");

		// Words that are object properties don't break anything.
		deepEqual(dict.suggest("length"), [ ], "Correctly spelled words receive no suggestions.");
		deepEqual(dict.suggest("length"), [ ], "Correctly spelled words receive no suggestions.");

		// See https://github.com/cfinke/Typo.js/issues/87
		deepEqual(dict.suggest("hostipal"), [ "hospital" ]);
	});

	test("Correct checking of words with no affixes", function () {
		equal(dict.check("I"), true);
		equal(dict.check("is"), true);
		equal(dict.check("makes"), true);
		equal(dict.check("example"), true);
		equal(dict.check("a"), true);
		equal(dict.check("aback"), true);
		equal(dict.check("juicily"), true);
		equal(dict.check("palmate"), true);
		equal(dict.check("palpable"), true);
	});

	test("Correct checking of root words with single affixes (affixes not used)", function () {
		equal(dict.check("paling"), true);
		equal(dict.check("arrant"), true);
	});

	test("Correct checking of root words with single affixes (affixes used)", function () {
		equal(dict.check("uncritically"), true);
		equal(dict.check("hypersensitiveness"), true);
		equal(dict.check("illusive"), true);
	});

	test("Capitalization is respected.", function () {
		equal(dict.check("A"), true);
		equal(dict.check("a"), true);
		equal(dict.check("AA"), true);
		equal(dict.check("Abbe"), true);
		equal(dict.check("Abbott's"), true);
		equal(dict.check("abbott's"), false);
		equal(dict.check("Yum"), true);
		equal(dict.check("yum"), true);
		equal(dict.check("YUM"), true);
		equal(dict.check("aa"), false);
		equal(dict.check("aaron"), false);
		equal(dict.check("abigael"), false);
		equal(dict.check("YVES"), true);
		equal(dict.check("yves"), false);
		equal(dict.check("Yves"), true);
		equal(dict.check("MacArthur"), true);
		equal(dict.check("Alex"), true);
		equal(dict.check("alex"), false);
	});

	test("Words not in the dictionary in any form are marked as misspelled.", function () {
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
	});

	test("Leading and trailing whitespace is ignored.", function () {
		equal(dict.check("concept "), true);
		equal(dict.check(" concept"), true);
		equal(dict.check("  concept"), true);
		equal(dict.check("concept  "), true);
		equal(dict.check("  concept  "), true);
	});

	test("ONLYINCOMPOUND flag is respected", function () {
		equal(dict.check("1th"), false);
		equal(dict.check("2th"), false);
		equal(dict.check("3th"), false);
	});

	test("Compound words", function () {
		equal(dict.check("1st"), true);
		equal(dict.check("2nd"), true);
		equal(dict.check("3rd"), true);
		equal(dict.check("4th"), true);
		equal(dict.check("5th"), true);
		equal(dict.check("6th"), true);
		equal(dict.check("7th"), true);
		equal(dict.check("8th"), true);
		equal(dict.check("9th"), true);
		equal(dict.check("10th"), true);
		equal(dict.check("11th"), true);
		equal(dict.check("12th"), true);
		equal(dict.check("13th"), true);
		equal(dict.check("1th"), false);
		equal(dict.check("2rd"), false);
		equal(dict.check("3th"), false);
		equal(dict.check("4rd"), false);
		equal(dict.check("100st"), false);
	});

	test("Possessives are properly checked.", function () {
		equal(dict.check("concept's"), true);
		// acceptability's is in the dictionary including the 's
		equal(dict.check("acceptability's's"), false);
	});

	test("Replacement rules are implemented", function () {
		deepEqual(dict.suggest("wagh"), [ "weigh" ]);
		deepEqual(dict.suggest("ceit"), [ "cat" ]);
		deepEqual(dict.suggest("seau"), [ "so" ]);
		deepEqual(dict.suggest("shaccable"), [ "shareable" ]);
		deepEqual(dict.suggest("soker"), [ "choker" ]);
	});

	test("Contractions", function () {
		equal(dict.check("aren't"), true);
		equal(dict.check("I'm"), true);
		equal(dict.check("we're"), true);
		equal(dict.check("didn't"), true);
		equal(dict.check("didn'ts"), false);
		equal(dict.check("he're"), false);
	});

	test("Capitalizations are handled properly.", function () {
		deepEqual(dict.suggest("Wagh"), ["Weigh"]);
		deepEqual(dict.suggest("CEIT"), [
			"CELT",
			"CENT",
			"CERT",
			"CHIT",
			"CLIT"
		] );
	});

	test("NOSUGGEST is respected", function () {
		// 'fart' is marked NOSUGGEST, and I've confirmed that it would be in the suggestions if we don't respect that flag.
		equal(dict.suggest("funck").indexOf('fuck'), -1);

		// If a NOSUGGEST word would be in the top 10 ('fart' is #5), Typo should still return the expected number of results.
		equal(dict.suggest("funck", 10).length, 10);
	});

	/**
	 * This is not a great test, since it has deep knowledge of the data structures used
	 * within Typo and modifies them manually, but it's the simplest way I could think to
	 * test this without updating Typo to add methods for dynamically adding/removing
	 * words, which I should probably also do.
	 */
	test("PRIORITYSUGGEST is respected", function () {
		var misspelled_word = 'prioraty';
		var priority_suggestion = 'priory';

		// Confirm that our word is not the top suggestion before we give it priority.
		equal( dict.suggest(misspelled_word, 5).indexOf( priority_suggestion ) == 0, false );
		/* ['priority', 'priorly', 'Priority', 'priory', 'prorate'] */

		// Delete the cached suggestions.
		delete dict.memoized[misspelled_word];

		// Add the PRIORITYSUGGEST flag and add our fake word with PRIORITYSUGGEST.
		dict.flags['PRIORITYSUGGEST'] = '@';
		dict.dictionaryTable[priority_suggestion].push('@');

		// Confirm that our new high-priority suggestion is the top suggestion now.
		equal( dict.suggest(misspelled_word, 5).indexOf(priority_suggestion), 0 );
		/* ['priory', 'priority', 'priorly', 'Priority', 'prorate'] */

		// Reset the dictionary state.
		delete dict.flags['PRIORITYSUGGEST'];
		dict.dictionaryTable[priority_suggestion].pop();
	} );
}

addEventListener( "load", run, false );