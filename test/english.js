var assert = require('assert');
var Typo = require('../src/typo');

var equal = assert.equal;
var deepEqual = assert.deepEqual;

// NOTE: This is mostly duplicated from tests/english.js for testing the precomputed functions only available in node-like environments
describe('english', function() {

	testGenerator(function(dict, next) {
		dict.load('en_US');
		next();
	})

	context('precomputed (sync)', function() {
		testGenerator(function(dict, done) {	
			dict.loadPrecomputed('en_US')
			done();
		})
	});

	context('precomputed (async)', function() {
		testGenerator(function(dict, done) {	
			dict.loadPrecomputed('en_US', null, null, {
				asyncLoad: true,
				loadedCallback: () => done()
			})
		})
	});


});

function testGenerator(b) {

	var dict;

	before(function(done) {
		dict = new Typo();
		b(dict, done);
	});


	it("Dictionary object attributes are properly set", function () {
		equal(dict.dictionary, "en_US");
	});
	
	it("Suggestions", function () {
		deepEqual(dict.suggest("speling", 3), [ "spelling", "spieling", "spewing" ]);

		// Repeated calls function properly.
		deepEqual(dict.suggest("speling", 1), [ "spelling" ]);
		deepEqual(dict.suggest("speling"), [ "spelling", "spieling", "spewing", "selling", "peeling" ]);
		deepEqual(dict.suggest("speling", 2), [ "spelling", "spieling" ]);
		deepEqual(dict.suggest("speling"), [ "spelling", "spieling", "spewing", "selling", "peeling" ]);

		// Requesting more suggestions than will be returned doesn't break anything.
		deepEqual(dict.suggest("spartang", 50), [ "spartan", "sparing", "starting", "sprang", "sporting", "spurting", "smarting", "sparking", "sparling", "sparring", "parting", "spatting" ]);
		deepEqual(dict.suggest("spartang", 30), [ "spartan", "sparing", "starting", "sprang", "sporting", "spurting", "smarting", "sparking", "sparling", "sparring", "parting", "spatting" ]);
		deepEqual(dict.suggest("spartang", 1), [ "spartan" ]);

		deepEqual(dict.suggest("spitting"), [ ], "Correctly spelled words receive no suggestions.");
		deepEqual(dict.suggest("spitting"), [ ], "Correctly spelled words receive no suggestions.");

		// Words that are object properties don't break anything.
		deepEqual(dict.suggest("length"), [ ], "Correctly spelled words receive no suggestions.");
		deepEqual(dict.suggest("length"), [ ], "Correctly spelled words receive no suggestions.");
	});
	
	it("Correct checking of words with no affixes", function () {
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
	
	it("Correct checking of root words with single affixes (affixes not used)", function () {
		equal(dict.check("paling"), true);
		equal(dict.check("arrangeable"), true);
		equal(dict.check("arrant"), true);
		equal(dict.check("swabby"), true);
	});

	it("Correct checking of root words with single affixes (affixes used)", function () {
		equal(dict.check("palmer's"), true);
		equal(dict.check("uncritically"), true);
		equal(dict.check("hypersensitiveness"), true);
		equal(dict.check("illusive"), true);
	});
	
	it("Capitalization is respected.", function () {
		equal(dict.check("A"), true);
		equal(dict.check("a"), true);
		equal(dict.check("AA"), true);
		equal(dict.check("ABANDONER"), true);
		equal(dict.check("abandonER"), true);
		equal(dict.check("Abandoner"), true);
		equal(dict.check("Abbe"), true);
		equal(dict.check("Abbott's"), true);
		equal(dict.check("abbott's"), false);
		equal(dict.check("Abba"), true);
		equal(dict.check("ABBA"), true);
		equal(dict.check("Abba's"), true);
		equal(dict.check("Yum"), true);
		equal(dict.check("yum"), true);
		equal(dict.check("YUM"), true);
		equal(dict.check("aa"), false);
		equal(dict.check("aaron"), false);
		equal(dict.check("abigael"), false);
		equal(dict.check("YVES"), true);
		equal(dict.check("yves"), false);
		equal(dict.check("Yves"), true);
		equal(dict.check("MACARTHUR"), true);
		equal(dict.check("MacArthur"), true);
		equal(dict.check("Alex"), true);
		equal(dict.check("alex"), false);
	});
	
	it("Words not in the dictionary in any form are marked as misspelled.", function () {
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
		equal(dict.check("aaraara"), false);
	});
	
	it("Leading and trailing whitespace is ignored.", function () {
		equal(dict.check("concept "), true);
		equal(dict.check(" concept"), true);
		equal(dict.check("  concept"), true);
		equal(dict.check("concept  "), true);
		equal(dict.check("  concept  "), true);
	});
	
	it("ONLYINCOMPOUND flag is respected", function () {
		equal(dict.check("1th"), false);
		equal(dict.check("2th"), false);
		equal(dict.check("3th"), false);
	});
	
	it("Compound words", function () {
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
	
	it("Possessives are properly checked.", function () {
		equal(dict.check("concept's"), true);
		// acceptability's is in the dictionary including the 's
		equal(dict.check("acceptability's's"), false);
	});
	
	it("Replacement rules are implemented", function () {
		deepEqual(dict.suggest("wagh"), [ "weigh" ]);
		deepEqual(dict.suggest("ceit"), [ "cat" ]);
		deepEqual(dict.suggest("seau"), [ "so" ]);
		deepEqual(dict.suggest("shaccable"), [ "shakable" ]);
		deepEqual(dict.suggest("soker"), [ "choker" ]);
	});
	
	it("Contractions", function () {
		equal(dict.check("aren't"), true);
		equal(dict.check("I'm"), true);
		equal(dict.check("we're"), true);
		equal(dict.check("didn't"), true);
		equal(dict.check("didn'ts"), false);
		equal(dict.check("he're"), false);
	});
	
	it("Capitalizations are handled properly.", function () {
		deepEqual(dict.suggest("Wagh"), ["Weigh"]);
		deepEqual(dict.suggest("CEIT"), [ "CERT", "CHIT", "CIT", "CENT", "CUT" ]);
	});

	it("NOSUGGEST is respected", function () {
		// 'fart' is marked NOSUGGEST, and I've confirmed that it would be in the suggestions if we don't respect that flag.
		equal(dict.suggest("faxt").indexOf('fart'), -1);
		
		// If a NOSUGGEST word would be in the top 10 ('fart' is #5), Typo should still return the expected number of results.
		equal(dict.suggest("faxt", 10).length, 10);
	});
}
