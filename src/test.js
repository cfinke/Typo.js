'use strict';

const fs = require('fs');
const Typo = require('./typo');

var dict = new Typo();
dict.loadPrecomputed('en_US');

console.log(dict.checkExact('vlcome') )//, dictStd.checkExact('vlcome'));

return;


/*
var dictStd = new Typo();
dictStd.load('en_US');

console.log(dictStd.compoundRules);
*/








/*
var n = 10000000000;
var t = new Date();
for(var i = 0; i < 1000000; i++) {
	tab.get('hello')
}

var te = new Date();

var secs = (te - t) / 1000;

console.log(secs);
console.log(n / secs);

*/


// TODO: Why are there commas in this?
/*
console.log(table.get('jgjgjhgjh'));


console.log(dict.check('Hello'))
*/

console.log(table.get('vlcome'));

