self.addEventListener('message', function(e) { 
	var words = e.data;
	
	var rv = [];
	var alphabet = "abcdefghijklmnopqrstuvwxyz";
	
	for (var ii = 0, _iilen = words.length; ii < _iilen; ii++) {
		var word = words[ii];
		
		var splits = [];
	
		for (var i = 0, _len = word.length + 1; i < _len; i++) {
			splits.push([ word.substring(0, i), word.substring(i, word.length) ]);
		}
	
		var deletes = [];
	
		for (var i = 0, _len = splits.length; i < _len; i++) {
			var s = splits[i];
		
			if (s[1]) {
				deletes.push(s[0] + s[1].substring(1));
			}
		}
	
		var transposes = [];
	
		for (var i = 0, _len = splits.length; i < _len; i++) {
			var s = splits[i];
		
			if (s[1].length > 1) {
				transposes.push(s[0] + s[1][1] + s[1][0] + s[1].substring(2));
			}
		}
	
		var replaces = [];
	
		for (var i = 0, _len = splits.length; i < _len; i++) {
			var s = splits[i];
		
			if (s[1]) {
				for (var j = 0, _jlen = alphabet.length; j < _jlen; j++) {
					replaces.push(s[0] + alphabet[j] + s[1].substring(1));
				}
			}
		}
	
		var inserts = [];
	
		for (var i = 0, _len = splits.length; i < _len; i++) {
			var s = splits[i];
		
			if (s[1]) {
				for (var j = 0, _jlen = alphabet.length; j < _jlen; j++) {
					inserts.push(s[0] + alphabet[j] + s[1]);
				}
			}
		}
				
		rv = rv.concat(inserts);
		rv = rv.concat(deletes);
		rv = rv.concat(transposes);
		rv = rv.concat(replaces);
	}
	
	postMessage(rv);
});
