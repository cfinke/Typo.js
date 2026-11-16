#!/usr/bin/env node
/**
 * Runs the Typo.js QUnit test suites (tests/*.js) in Node.js.
 *
 *   node tests/run.js                           # run every suite against typo/typo.js
 *   node tests/run.js english french            # run only the named suites
 *   node tests/run.js --build path/to/typo.js   # run against another build of typo.js
 *
 * The test files were written for a browser extension: they rely on a global `Typo`
 * constructor, `chrome.runtime.getURL()`, `addEventListener("load", ...)` and the
 * QUnit 1.x globals (test, asyncTest, equal, deepEqual, ok, throws, QUnit.start).
 * This runner provides minimal stand-ins for all of them.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const util = require("util");

const projectRoot = path.resolve(__dirname, "..");
const suitesDir = __dirname;
const allSuites = ["general", "english", "british", "latin", "german", "french", "spanish"];

const args = process.argv.slice(2);
let build = path.join(projectRoot, "typo", "typo.js");
const suites = [];

for (let i = 0; i < args.length; i++) {
	if (args[i] === "--build") {
		build = path.resolve(args[++i]);
	} else {
		suites.push(args[i]);
	}
}

const Implementation = require(build);

/* ------------------------------------------------------------------------------------------------
 * Browser / extension environment stand-ins
 * ---------------------------------------------------------------------------------------------- */

// Typo loads dictionaries through chrome.runtime.getURL() when `window` is defined; mapping
// URLs to paths under the project root mirrors the extension layout.
const chrome = {
	runtime: {
		getURL(relative) {
			// Like a chrome-extension:// URL, "../" can never climb above the extension root.
			return path.join(projectRoot, path.posix.normalize("/" + relative));
		}
	}
};

// A file-backed XMLHttpRequest, so that older builds of Typo.js (which prefer XHR when it
// exists) can load files the way they do in a browser extension.
class FileXMLHttpRequest {
	constructor() {
		this.status = 0;
		this.statusText = "";
		this.responseText = "";
		this.charset = "utf-8";
		this.onload = null;
		this.onerror = null;
	}

	open(method, url, async) {
		this.url = url;
		this.async = !!async;
	}

	overrideMimeType(mimeType) {
		const match = /charset=([^;\s]+)/i.exec(mimeType);

		if (match) {
			this.charset = match[1];
		}
	}

	read() {
		try {
			const bytes = fs.readFileSync(this.url);
			let label = this.charset.toLowerCase();

			if (label === "utf8") {
				label = "utf-8";
			}

			this.responseText = new TextDecoder(label).decode(bytes);
			this.status = 200;
			this.statusText = "OK";
		} catch (error) {
			this.status = 404;
			this.statusText = error.code || "Not Found";
			this.responseText = "";
		}
	}

	send() {
		if (this.async) {
			setTimeout(() => {
				this.read();

				if (this.status === 200) {
					this.onload && this.onload();
				} else {
					this.onerror && this.onerror();
				}
			}, 0);
		} else {
			this.read();
		}
	}
}

let pendingLoads = 0;

// Wraps the constructor so that the runner can wait for asynchronous dictionary loads.
function Typo(dictionary, affData, wordsData, settings) {
	const tracked = !!(settings && typeof settings === "object" && settings.asyncLoad && typeof settings.loadedCallback === "function");

	if (tracked) {
		const callback = settings.loadedCallback;

		pendingLoads++;
		settings = Object.assign({}, settings, {
			loadedCallback(dict) {
				pendingLoads--;
				callback(dict);
			}
		});
	}

	try {
		return new Implementation(dictionary, affData, wordsData, settings);
	} catch (error) {
		if (tracked) {
			pendingLoads--;
		}

		throw error;
	}
}

// Instances are created by the implementation, so share its prototype and static API.
Typo.prototype = Implementation.prototype;

if (typeof Implementation.load === "function") {
	Typo.load = (dictionary, settings) => Implementation.load(dictionary, settings);
}

const listeners = [];

Object.assign(globalThis, {
	Typo,
	chrome,
	window: { chrome },
	XMLHttpRequest: FileXMLHttpRequest,
	addEventListener(type, listener) {
		if (type === "load") {
			listeners.push(listener);
		}
	}
});

/* ------------------------------------------------------------------------------------------------
 * QUnit stand-ins
 * ---------------------------------------------------------------------------------------------- */

const queue = [];
let current = null;
let asyncResume = null;

function record(passed, message, detail) {
	current.assertions++;

	if (!passed) {
		current.failures.push({ message: message || "", detail });
	}
}

function format(value) {
	return util.inspect(value, { depth: 4, breakLength: 120 });
}

function describeDiff(actual, expected) {
	return `expected ${format(expected)}\n           actual   ${format(actual)}`;
}

const QUnit = {
	start() {
		if (asyncResume) {
			const resume = asyncResume;

			asyncResume = null;
			resume();
		}
	},
	pushFailure(message) {
		record(false, String(message));
	}
};

const assert = {
	ok(value, message) {
		record(!!value, message, `expected truthy, got ${format(value)}`);
	},
	equal(actual, expected, message) {
		// eslint-disable-next-line eqeqeq
		record(actual == expected, message, describeDiff(actual, expected));
	},
	deepEqual(actual, expected, message) {
		record(util.isDeepStrictEqual(actual, expected), message, describeDiff(actual, expected));
	},
	throws(block, expected, message) {
		let threw = false;
		let error;

		try {
			// QUnit 1.x calls the block with the test environment as `this`.
			block.call({});
		} catch (e) {
			threw = true;
			error = e;
		}

		let passed = threw;

		if (threw && typeof expected === "function") {
			passed = expected(error) === true;
		}

		record(passed, message, threw ? `unexpected error ${format(error)}` : "no exception thrown");
	}
};

Object.assign(globalThis, {
	QUnit,
	ok: assert.ok,
	equal: assert.equal,
	deepEqual: assert.deepEqual,
	throws: assert.throws,
	test(name, callback) {
		queue.push({ name, callback, async: false });
	},
	asyncTest(name, callback) {
		queue.push({ name, callback, async: true });
	}
});

/* ------------------------------------------------------------------------------------------------
 * Runner
 * ---------------------------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTest(entry) {
	current = { name: entry.name, assertions: 0, failures: [] };

	try {
		if (entry.async) {
			const finished = new Promise((resolve) => {
				asyncResume = resolve;
			});

			entry.callback(assert);
			await Promise.race([finished, sleep(30000).then(() => {
				record(false, "asyncTest did not call QUnit.start() within 30s");
			})]);
		} else {
			entry.callback(assert);
		}
	} catch (error) {
		record(false, "Test threw an exception", format(error));
	}

	return current;
}

async function runSuite(name) {
	const file = path.join(suitesDir, name + ".js");
	const source = fs.readFileSync(file, "utf8");

	listeners.length = 0;
	queue.length = 0;
	pendingLoads = 0;

	console.log(`\n== ${name} (${path.relative(projectRoot, file)})`);

	const started = Date.now();

	vm.runInThisContext(source, { filename: file });

	let passed = 0;
	let failed = 0;
	let assertions = 0;

	for (const listener of listeners) {
		try {
			listener();
		} catch (error) {
			failed++;
			console.log(`  FAIL  suite setup threw an exception`);
			console.log(`        ${format(error)}`);
		}
	}

	// Keep going while tests are queued or an asynchronous load may still queue more.
	let idleSince = Date.now();

	while (queue.length > 0 || pendingLoads > 0) {
		if (queue.length === 0) {
			if (Date.now() - idleSince > 60000) {
				failed++;
				console.log(`  FAIL  ${pendingLoads} asynchronous dictionary load(s) never called loadedCallback (waited 60s)`);

				break;
			}

			await sleep(10);

			continue;
		}

		idleSince = Date.now();

		const result = await runTest(queue.shift());

		assertions += result.assertions;

		if (result.failures.length === 0) {
			passed++;
			console.log(`  PASS  ${result.name} (${result.assertions} assertions)`);
		} else {
			failed++;
			console.log(`  FAIL  ${result.name}`);

			for (const failure of result.failures) {
				console.log(`        - ${failure.message}`);

				if (failure.detail) {
					console.log(`           ${failure.detail}`);
				}
			}
		}
	}

	console.log(`  ${passed} passed, ${failed} failed, ${assertions} assertions, ${Date.now() - started} ms`);

	return { passed, failed, assertions };
}

(async () => {
	const totals = { passed: 0, failed: 0, assertions: 0 };
	const selected = suites.length > 0 ? suites : allSuites;

	console.log(`Running test suites against ${path.relative(projectRoot, build)}`);

	for (const name of selected) {
		const result = await runSuite(name);

		totals.passed += result.passed;
		totals.failed += result.failed;
		totals.assertions += result.assertions;
	}

	console.log(`\nTotal: ${totals.passed} tests passed, ${totals.failed} failed, ${totals.assertions} assertions.`);
	process.exit(totals.failed > 0 ? 1 : 0);
})();
