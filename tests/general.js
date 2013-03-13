function run() {
	var empty_dict = new Typo();
	
	test("Dictionary instantiated without arguments is essentially empty.", function () {
		deepEqual(empty_dict.rules, {});
		deepEqual(empty_dict.dictionaryTable, {});
		deepEqual(empty_dict.dictionary, null);
	});
	
	test("Comments are removed from affix files", function () {
		equal(empty_dict._removeAffixComments("# abc\ndef # ghi\n # jkl\nmnop qrst\n##"), "def\nmnop qrst", "Comment lines are removed.");
		equal(empty_dict._removeAffixComments(""), "", "Handles empty input.");
		equal(empty_dict._removeAffixComments("abc"), "abc", "Handles input that doesn't need changing.");
		equal(empty_dict._removeAffixComments(" abc"), "abc", "Leading whitespace is removed.");
		equal(empty_dict._removeAffixComments(" abc "), "abc", "Leading and trailing whitespace is removed.");
		equal(empty_dict._removeAffixComments("\n\n\abc\n"), "abc", "Leading and trailing newlines are removed.");
		equal(empty_dict._removeAffixComments("\n\n"), "", "Consecutive newlines are removed.");
		equal(empty_dict._removeAffixComments("\t"), "", "Tabs are treated as whitespace.");
		equal(empty_dict._removeAffixComments("\n\t \t\n\n"), "", "All whitespace is treated the same.");
	});
}

addEventListener( "load", run, false );