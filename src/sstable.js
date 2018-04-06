
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

			this._bins.push([ off, prefixLen, str ]);
		}

		this._start = cur;

		// For convenience, we add another end stop bin
		this._bins.push([ buf.byteLength - cur ]);
	}

	get(key) {
		var kbytes = this._toUTF8(key);


		// Binary search index for the right bin
		var startI = 0,
			endI = this._bins.length - 1; // -1 because the last bin is just the EOF pointer
		
		var midI;
		while(endI - startI > 1) {
			midI = Math.floor((endI + startI) / 2);
			if(this._arrCompare(kbytes, this._bins[midI][2]) >= 0) { // If key is after the start of the bin
				startI = midI;
			}
			else {
				endI = midI;
			}
		}

		// This will be the index of the bin which this key must be in if any
		var idx = startI;


		// In order to be in this bin, the prefix must match
		var pfxLen = this._bins[idx][1];
		if(kbytes.length < pfxLen) {
			return undefined;
		}

		for(var i = 0; i < pfxLen; i++) {
			if(this._bins[idx][2][i] !== kbytes[i]) {
				return undefined;
			}
		}

		// Remove prefix from query key
		kbytes = kbytes.slice(pfxLen);
		var klen = kbytes.length;


		// We need to scan the entire bin to 

		var start = this._start + this._bins[idx][0],
			end = this._start + this._bins[idx + 1][0];

		var match = false,
			len,
			i;


		while(start < end) {
			// Read key
			len = this._bytes[start++];
			if(len === klen) {
				match = true;
				for(i = 0; i < len; i++) {
					if(this._bytes[start + i] !== kbytes[i]) {
						match = false;
						break;
					}
				}
			}
			start += len; // Advance by key size

			// Read value
			len = this._bytes[start++];
			if(match) {
				return this._fromUTF8(start, len);
			}

			start += len; // Advance by value size
		}

		// Doesn't exist
		return undefined;
	}

	// Comparison of binary strings
	_arrCompare(a, b) {
		for(var i = 0; i < Math.min(a.length, b.length); i++) {
			if(a[i] < b[i]) {
				return -1;
			}
			else if(a[i] > b[i]) {
				return 1;
			}
		}

		if(a.length === b.length) {
			return 0;
		}

		if(a.length > b.length) {
			return 1;
		}
		else {
			return -1;
		}
	}


	// Converts a javascript string to a list of numbers representing
	_toUTF8(k) {
		k = utf8.encode(k);
		var out = []

		for(var i = 0; i < k.length; i++) {
			out.push(k.charCodeAt(i));
		}

		return out;
 	}

	_fromUTF8(start, len) {
		var s = '';
		for(var i = 0; i < len; i++) {
			var si = String.fromCharCode(this._bytes[start + i]);
			s += si;
		}

		return utf8.decode(s);
	}

}

module.exports = SSTable;
