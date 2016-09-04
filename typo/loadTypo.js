"use strict";

// loadTypo returns a promise resolved when the given dictionaries are loaded
function loadTypo(affPath, dicPath) {
	return new Promise(function(resolve, reject) {
		var xhr_aff = new XMLHttpRequest();
		xhr_aff.open('GET', affPath, true);
		xhr_aff.onload = function() {
			if (xhr_aff.readyState === 4 && xhr_aff.status === 200) {
				//console.log('aff loaded');
				var xhr_dic = new XMLHttpRequest();
				xhr_dic.open('GET', dicPath, true);
				xhr_dic.onload = function() {
					if (xhr_dic.readyState === 4 && xhr_dic.status === 200) {
						//console.log('dic loaded');
						resolve(new Typo('en_US', xhr_aff.responseText, xhr_dic.responseText, { platform: 'any' }));
					} else {
						//console.log('failed loading dic');
						reject();
					}
				};
				//console.log('loading dic');
				xhr_dic.send(null);
			} else {
				//console.log('failed loading aff');
				reject();
			}
		};
		//console.log('loading aff');
		xhr_aff.send(null);
	});
}
