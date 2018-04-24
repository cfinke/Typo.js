#!/usr/bin/env node

'use strict';


const Typo = require('../src/typo');

function time(name, f, iters) {
	iters = iters || 1;

	let t = new Date();
	for(var i = 0; i < iters; i++) {
		f();
	}
	let te = new Date();
	
	let elapsed = ((te - t) / 1000) + 's';
	console.log(name, elapsed)
}

console.log('Dictionary load time');

var dict = new Typo();
time('- regular', () => dict.load('en_US'));


var preDict = new Typo();
time('- precomputed', () => preDict.loadPrecomputed('en_US'));


console.log('\n\ndict.check() speed');
var words = ['hypersensitiveness', "Abbott's", '9th', 'aaraara', "didn't", "he're"];

var n = 1000000;
words.map((w) => {
	time('- ' + w + ' (reg)', () => dict.check(w), n);
	time('- ' + w + ' (pre)', () => preDict.check(w), n);
})

