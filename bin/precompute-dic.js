#!/usr/bin/env node
/*
	The hunspell '.dic' dictionaries that typo.js take too long to load for most web applications and the default javascript object based word table is very inefficient on memory.

	This is a node.js script for taking an existing dictionary, loading it the regular way and then outputing 

	Usage:
	- call as ./bin/precompute-dic.js [local_code] [path_to_dictionaries_folder]

	- default usage is equivalent to "./bin/precompute-dic.js en_US ./src/dictionaries"
*/

'use strict';

const fs = require('fs');
const path = require('path');
const sstab = require('sstab');

var DICT = process.argv[2] || 'en_US';
var FOLDER = path.resolve(process.argv[3] || (__dirname + '/../src/dictionaries/'));
var BINSIZE = 12; /**< Number of strings per sst bin */

console.log();


var Typo = require('../src/typo', null, null, { dictionaryPath: FOLDER });
var dict = new Typo();
dict.load(DICT)

console.log('# Expanded Words:', Object.keys(dict.dictionaryTable).length)
console.log('Flags:', dict.flags)

var dt = dict.dictionaryTable;


var obj = {};

console.log('1/4 Compressing values');
for(var k in dt) {
	if(dt.hasOwnProperty(k)) {
		var v = dt[k]? dt[k] : [];

		// Making that that the charset loading correctly
		if(k.slice(2) == 'rich' && k[0] == 'Z') {
			console.log(k.charCodeAt(1), '==', 'Zürich'.charCodeAt(1)); // Should be 'Zürich'
		}
		
		// Remove rules that have already been applied
		for(var i = 0; i < v.length; i++) {
			var r = dict.rules[v[i]];
			if(r && (r.type === 'PFX' || r.type === 'SFX')) {
				v.splice(i, 1);
				i--;
			}
		}

		v = v.join('');

		if(typeof(v) !== 'string') {
			console.log('Unsupported flags:', typeof(v));
		}

		obj[k] = v;
	}
}


console.log('2/3 Creating table');

var buf = sstab.build(obj);


console.log('3/3 Saving');

// Generate metadata file
fs.writeFileSync(FOLDER + `/${DICT}/${DICT}.json`, JSON.stringify({
	compoundRuleCodes: dict.compoundRuleCodes,
	dictionary: dict.dictionary,
	rules: dict.rules,
	compoundRules: dict.compoundRules.map((r) => r.toString()), // Regex needs to be explicitly stringified for JSON serialization
	compoundRuleCodes: dict.compoundRuleCodes,
	replacementTable: dict.replacementTable,
	flags: dict.flags,
	loaded: dict.loaded
}))

fs.writeFileSync(FOLDER + `/${DICT}/${DICT}.sst`, buf);

console.log('Done!');


