var Typo = function (dictionary) {
	this.dictionary = dictionary;
	
	return this;
};

Typo.prototype = {
	/**
	 * Checks whether a word exists in the current dictionary.
	 *
	 * @todo Not yet implemented.
	 *
	 * @param string word The word to check.
	 * @return boolean
	 */
	
	check : function (word) {
	},
	
	/**
	 * Returns a list of suggestions for a misspelled word.
	 *
	 * @todo Not yet implemented.
	 *
	 * @param string word The misspelling.
	 * @return string[] The array of suggestions.
	 */
	
	suggest : function (word) {
	}
};