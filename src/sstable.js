
'use strict';

var utf8 = require('utf8');


/**
 * A read only sorted string table using raw buffers
 *
 * NOTE: Both the key and values are constrained to 256 utf8 bytes
 */
class SSTable {

	/**
	 * @param buf should be an ArrayBuffer (use buf.buffer if using a node.js style buffer)
	 */
	constructor(buf) {
		this._buf = buf;
		this._bytes = new Uint8Array(buf);

		var view = new DataView(buf);

		var nbins = view.getUint32(0, true);

		
		this._bins = [];

		var cur = 4;

		for(var i = 0; i < nbins; i++) {

			var off = view.getUint32(cur, true);
			cur += 4;

			var prefixLen = view.getUint8(cur);
			cur += 1;

			var strLen = view.getUint8(cur);
			cur += 1;

			var str = this._bytes.slice(cur, cur + strLen);
			cur += strLen;

			this._bins.push({ off: off, pfx: prefixLen, str: str });
		}

		this._start = cur;

		for(var i = 0; i < this._bins.length; i++) {
			this._bins[i].off += cur;
		}

		// For convenience, we add another end stop bin
		this._bins.push([ buf.byteLength ]);
	}

	get(key) {
		var kbytes = toUTF8(key);


		// Binary search index for the right bin
		var startI = 0,
			endI = this._bins.length - 1; // -1 because the last bin is just the EOF pointer
		
		var midI;
		while(endI - startI > 1) {
			midI = (endI + startI) >> 1; // Math.floor((endI + startI) / 2);
			if(arrCompare(kbytes, this._bins[midI].str) >= 0) { // If key is after the start of the bin
				startI = midI;
			}
			else {
				endI = midI;
			}
		}

		// This will be the index of the bin which this key must be in if any
		var idx = startI;


		// In order to be in this bin, the prefix must match
		var pfxLen = this._bins[idx].pfx;
		if(kbytes.length < pfxLen) {
			return undefined;
		}

		for(var i = 0; i < pfxLen; i++) {
			if(this._bins[idx].str[i] !== kbytes[i]) {
				return undefined;
			}
		}

		// Remove prefix from query key
		//kbytes = kbytes.slice(pfxLen);
		var klen = kbytes.length - pfxLen;


		// We need to scan the entire bin to 

		var start = this._bins[idx].off,
			end = this._bins[idx + 1].off;

		var match = false,
			len,
			i;
		

		while(start < end) {
			// Read key
			len = this._bytes[start++];
			if(len === klen) {
				match = true;
				for(i = 0; i < len; i++) {
					if(this._bytes[start + i] !== kbytes[pfxLen + i]) {
						match = false;
						break;
					}
				}
			}
			start += len; // Advance by key size

			// Read value
			len = this._bytes[start++];
			if(match) {
				return fromUTF8(this._bytes, start, len);
			}

			start += len; // Advance by value size
		}

		// Doesn't exist
		return undefined;
	}


}

// Converts a javascript string to a list of numbers representing
function toUTF8(k) {
	k = utf8.encode(k);
	var out = []

	for(var i = 0; i < k.length; i++) {
		out.push(k.charCodeAt(i));
	}

	return out;
 }

function fromUTF8(bytes, start, len) {
	var s = '';
	for(var i = 0; i < len; i++) {
		var si = String.fromCharCode(bytes[start + i]);
		s += si;
	}

	return utf8.decode(s);
}

// Comparison of binary strings
function arrCompare(a, b) {
	var len = Math.min(a.length, b.length)
	for(var i = 0; i < len; i++) {
		if(a[i] < b[i]) {
			return -1;
		}
		else if(a[i] > b[i]) {
			return 1;
		}
	}

	return a.length - b.length;

	/*
	if(a.length === b.length) {
		return 0;
	}
	else if(a.length > b.length) {
		return 1;
	}
	else {
		return -1;
	}
	*/
}


module.exports = SSTable;
