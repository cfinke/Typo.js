#!/usr/bin/env node
"use strict";
const spawnSync = require("child_process").spawnSync;
const COMPILER_PATH = require("google-closure-compiler").compiler.COMPILER_PATH;

const args = ["-jar", COMPILER_PATH].concat(get_args());
const result = spawnSync("java", args, { stdio: "inherit" });
if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error('Could not find "java" in your PATH.');
  } else {
    console.error(result.error.message);
  }
  process.exit(1);
} else {
  process.exit(result.status);
}

function get_args() {
  const entryPoint = process.argv[2];
  const outputFile = process.argv[3];

  console.log("Entry point:", entryPoint);
  console.log("Output:", outputFile);

  return [
    "--process_common_js_modules",
    "--module_resolution",
    "NODE",
    "--dependency_mode",
    "STRICT",
    "--compilation_level",
    "SIMPLE",
    "--isolation_mode",
    "IIFE",
    "--language_in",
    "ECMASCRIPT5_STRICT",
    "--language_out",
    "ECMASCRIPT5_STRICT",
    "--entry_point",
    entryPoint,
    "--js_output_file",
    outputFile,
    "--js",
    "build/ts/**.js"
  ];
}
