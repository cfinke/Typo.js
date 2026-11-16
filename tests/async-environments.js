/**
 * Tests whether asyncLoad: true works with and without `window`: in a bare JavaScript
 * environment, a web worker, and browsers with and without requestIdleCallback. The
 * scenarios run in sandboxes that don't define `process`, so none of them takes Typo's
 * Node.js code path.
 *
 * Usage:
 *   node tests/async-environments.js                  # tests typo/typo.js
 *   node tests/async-environments.js path/to/typo.js  # tests a specific build
 *   node tests/async-environments.js --compare        # also tests typo/typo.js from the last 1.x commit
 *   node tests/async-environments.js --compare=<rev>  # also tests typo/typo.js from another git revision
 *
 * Each scenario constructs Typo with preloaded .aff/.dic data and asyncLoad: true,
 * then waits for loadedCallback. A scenario passes if the constructor does not throw
 * and the callback fires with a dictionary that spells "color" correctly.
 *
 * Asynchronous loading in Node.js, including reading the dictionary files themselves, is
 * covered by the Typo.load tests in tests/general.js.
 */

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var child_process = require("child_process");

var root = path.resolve(__dirname, "..");
var dictDir = path.join(root, "typo", "dictionaries", "en_US", "en_US");
var affData = fs.readFileSync(dictDir + ".aff", "utf8");
var wordsData = fs.readFileSync(dictDir + ".dic", "utf8");

// The last commit before the 2.0.0 rewrite.
var DEFAULT_COMPARE_REVISION = "69f6c77";

var args = process.argv.slice(2);
var compareArg = args.filter(function (a) { return /^--compare(=|$)/.test(a); })[0];
var compareRevision = compareArg ? (compareArg.split("=")[1] || DEFAULT_COMPARE_REVISION) : null;
var target = args.filter(function (a) { return a !== compareArg; })[0] || path.join(root, "typo", "typo.js");

// Load a typo.js source string in a fresh VM context so each scenario gets its own globals.
function loadTypo(source, label, globals) {
	var sandbox = Object.assign({
		console: console,
		require: require,
		module: { exports: {} },
		Promise: Promise,
		setTimeout: setTimeout,
		setImmediate: setImmediate,
		Symbol: Symbol,
		Map: Map,
		Buffer: Buffer,
	}, globals);
	sandbox.exports = sandbox.module.exports;
	vm.createContext(sandbox);
	vm.runInContext(source, sandbox, { filename: label });
	return sandbox.module.exports;
}

function fakeIdleCallback(cb) {
	setImmediate(function () {
		var start = Date.now();
		cb({ timeRemaining: function () { return Math.max(0, 5 - (Date.now() - start)); } });
	});
}

var scenarios = [
	{ name: "No window, self or process (bare JavaScript environment)", globals: {} },
	{ name: "Web worker (self defined, no window)", globals: { self: {} } },
	{ name: "Browser (window.requestIdleCallback present)", globals: { window: { requestIdleCallback: fakeIdleCallback } } },
	{ name: "Browser without idle callbacks (e.g. Safari)", globals: { window: {} } },
];

function runScenario(source, buildLabel, scenario) {
	return new Promise(function (resolve) {
		var Typo;
		try {
			Typo = loadTypo(source, buildLabel, scenario.globals);
		} catch (e) {
			return resolve({ ok: false, detail: "failed to load build: " + e });
		}

		var timer = setTimeout(function () {
			resolve({ ok: false, detail: "loadedCallback never fired within 10s" });
		}, 10000);

		try {
			new Typo("en_US", affData, wordsData, {
				asyncLoad: true,
				loadedCallback: function (dict) {
					clearTimeout(timer);
					var good = dict.loaded && dict.check("color") === true && dict.check("colr") === false;
					resolve({ ok: good, detail: good ? "loaded, check() correct" : "loaded but check() gave wrong results" });
				},
			});
		} catch (e) {
			clearTimeout(timer);
			resolve({ ok: false, detail: "constructor threw: " + e });
		}
	});
}

async function runBuild(source, buildLabel) {
	console.log("\n== " + buildLabel + " ==");
	var failures = 0;
	for (var i = 0; i < scenarios.length; i++) {
		var result = await runScenario(source, buildLabel, scenarios[i]);
		if (!result.ok) failures++;
		console.log((result.ok ? "  PASS  " : "  FAIL  ") + scenarios[i].name + " — " + result.detail);
	}
	return failures;
}

(async function () {
	var builds = [{ label: target, source: fs.readFileSync(target, "utf8") }];

	if (compareRevision) {
		var compareLabel = compareRevision + ":typo/typo.js";

		try {
			var compareSource = child_process.execFileSync("git", ["show", compareLabel], { cwd: root, encoding: "utf8" });
			builds.unshift({ label: compareLabel, source: compareSource });
		} catch (e) {
			console.log("Could not read " + compareLabel + " via git: " + e.message);
		}
	}

	var totalFailures = 0;
	for (var i = 0; i < builds.length; i++) {
		totalFailures += await runBuild(builds[i].source, builds[i].label);
	}

	console.log("");
	process.exit(totalFailures ? 1 : 0);
})();
