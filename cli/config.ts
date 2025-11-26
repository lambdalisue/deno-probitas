/**
 * Configuration file loader for Probitas
 *
 * @module
 */

import { parse as parseJsonc } from "@std/jsonc";
import { is, maybe } from "@core/unknownutil";
import type { DefaultStepOptions } from "../src/runner/types.ts";
import type { ProbitasConfig } from "./types.ts";

/**
 * Load Probitas configuration from a deno.json/deno.jsonc file
 *
 * @param configPath - Path to deno.json/deno.jsonc file (absolute or relative)
 * @returns Probitas configuration from the "probitas" section
 * @throws Error if the file cannot be read
 *
 * @requires --allow-read Permission to read config file
 */
export async function loadConfig(
  configPath: string,
): Promise<ProbitasConfig> {
  const content = await Deno.readTextFile(configPath);
  const config = parseJsonc(content) as Record<string, unknown>;
  return parseProbitasConfig(config.probitas || {});
}

/**
 * Parse and validate probitas configuration section
 *
 * @param raw - Raw configuration object from deno.json
 * @returns Parsed ProbitasConfig with validation
 */
function parseProbitasConfig(raw: unknown): ProbitasConfig {
  if (!is.ObjectOf({})(raw)) {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const isStringArray = is.ArrayOf(is.String);
  const isReporter = is.LiteralOneOf(["dot", "list", "json", "tap"] as const);

  return {
    reporter: maybe(obj.reporter, isReporter),
    includes: maybe(obj.includes, isStringArray),
    excludes: maybe(obj.excludes, isStringArray),
    selectors: maybe(obj.selectors, isStringArray),
    maxConcurrency: maybe(obj.maxConcurrency, is.Number),
    maxFailures: maybe(obj.maxFailures, is.Number),
    stepOptions: obj.stepOptions as DefaultStepOptions | undefined,
  };
}
