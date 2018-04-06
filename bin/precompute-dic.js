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
const path = require('path')

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


var pairs = [];

console.log('1/4 Extracting words');
for(var k in dt) {
	if(dt.hasOwnProperty(k)) {
		var v = dt[k]? dt[k] : [];

		// Making that that the charset loading correctly
		if(k.slice(2) == 'rich' && k[0] == 'Z') {
			console.log('Hello', k.charCodeAt(1), 'Zürich'.charCodeAt(1)); // Should be 'Zürich'
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


		pairs.push({ k: Buffer.from(k, 'utf8'), v: v });
	}
}


console.log('2/4 Creating table');

// This will perform a sort on UTF-8 strings in the buffers
pairs.sort((a, b) => {
	return Buffer.compare(a.k, b.k);
})


console.log('3/4 Binning');


// Generate bin boundaries
var bins = []; // NOTE: This is an array of buffers
var strings = []; // < Also an array of buffers

var pos = 0;
var binI = 0, /**< Starting pair index for the current bin */
	prefix = null; /**< Common prefix of all keys seen so far in this bin */

var i; /**< Index of the current pair we are on */

// Called when we want to flush all pairs in the range [binI, i) into the buffer we are building
function finishBucket() {

	var posBuf = Buffer.allocUnsafe(4);
	posBuf.writeUInt32LE(pos, 0);

	var b = Buffer.concat([
		posBuf, /**< 32bit position in table (starting at end of indexes) */
		Buffer.from([ prefix.length ]), /**< Number of prefix bytes */
		Buffer.from([ pairs[binI].k.byteLength ]),  /**< Length of key below */
		pairs[binI].k /**< The full key located at the beginning of this bucket */
	]);
	bins.push(b);

	for(var j = binI; j < i; j++) {

		var p = pairs[j];

		var kb = p.k;
		kb = kb.slice(prefix.length);

		var vb = Buffer.from(p.v, 'utf8');

		var str = Buffer.concat([
			Buffer.from([ kb.byteLength ]),
			kb,
			Buffer.from([ vb.byteLength ]),
			vb
		]);

		strings.push(str);
		pos += str.length;
	}
}

for(i = 0; i < pairs.length; i++) {

	// At a fixed interval, flush the button and start a new one
	if(i % BINSIZE === 0) {
		// Finish the last button
		if(i > 0) {
			finishBucket();
		}

		// Start a new bucket
		binI = i;
		prefix = pairs[i].k;
	}
	// Otherwise, we are still adding to a bucket, so update the prefix seen so far
	else {
		var c;
		for(c = 0; c < Math.min(pairs[i].k.byteLength, prefix.byteLength); c++) {
			if(pairs[i].k[c] !== prefix[c]) {
				break;
			}
		}

		prefix = prefix.slice(0, c);
	}

	if(i % 2000 === 0) {
		console.log('- ' + i + ' / ' + pairs.length);
	}
}

if(prefix !== null) {
	finishBucket();
}


console.log('- Created: ' + bins.length + ' bins from ' + pairs.length + ' key-value pairs');


// Make one file out of all of the buffers

var bufBinsLen = Buffer.allocUnsafe(4);
bufBinsLen.writeUInt32LE(bins.length);
var bufBins = Buffer.concat(bins);
var bufStrings = Buffer.concat(strings);

var sstBuf = Buffer.concat([ bufBinsLen, bufBins, bufStrings ]);




console.log('4/4 Saving');

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

fs.writeFileSync(FOLDER + `/${DICT}/${DICT}.sst`, sstBuf);

console.log('Done!');


