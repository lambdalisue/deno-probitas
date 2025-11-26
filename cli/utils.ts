/**
 * Utility functions for CLI
 *
 * @module
 */

import {
  DotReporter,
  JSONReporter,
  ListReporter,
  TAPReporter,
} from "../src/reporter/mod.ts";
import type { ReporterOptions } from "../src/reporter/types.ts";
import type { Reporter, ScenarioDefinition } from "../src/runner/types.ts";
import { parseSelector } from "./types.ts";
import type { Selector } from "./types.ts";

/**
 * Resolve reporter by name or return Reporter instance
 *
 * @param reporter - Reporter name or instance
 * @param options - Optional reporter options
 * @returns Reporter instance
 */
export function resolveReporter(
  reporter: string | Reporter | undefined,
  options?: ReporterOptions,
): Reporter {
  if (!reporter) {
    return new ListReporter(options);
  }

  if (typeof reporter === "string") {
    const reporterMap: Record<string, (opts?: ReporterOptions) => Reporter> = {
      "list": (opts) => new ListReporter(opts),
      "dot": (opts) => new DotReporter(opts),
      "json": (opts) => new JSONReporter(opts),
      "tap": (opts) => new TAPReporter(opts),
    };

    const factory = reporterMap[reporter];
    if (!factory) {
      throw new Error(`Unknown reporter: ${reporter}`);
    }

    return factory(options);
  }

  return reporter;
}

/**
 * Parse max concurrency option
 *
 * @param maxConcurrency - Max concurrency value
 * @returns Concurrency value or undefined for default
 */
export function parseMaxConcurrency(
  maxConcurrency?: string | number,
): number | undefined {
  if (maxConcurrency === undefined) {
    return undefined;
  }

  if (typeof maxConcurrency === "string" && maxConcurrency.includes(".")) {
    throw new Error("max-concurrency must be a positive integer");
  }

  const num = typeof maxConcurrency === "number"
    ? maxConcurrency
    : parseInt(maxConcurrency, 10);

  if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
    throw new Error("max-concurrency must be a positive integer");
  }

  return num;
}

/**
 * Parse max failures option
 *
 * @param maxFailures - Max failures value
 * @returns Failure count or undefined if not set
 */
export function parseMaxFailures(
  maxFailures?: string | number,
): number | undefined {
  if (maxFailures === undefined) {
    return undefined;
  }

  if (typeof maxFailures === "string" && maxFailures.includes(".")) {
    throw new Error("max-failures must be a positive integer");
  }

  const num = typeof maxFailures === "number"
    ? maxFailures
    : parseInt(maxFailures, 10);

  if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
    throw new Error("max-failures must be a positive integer");
  }

  return num;
}

/**
 * Read template file from assets/templates
 *
 * @param filename - Template filename
 * @returns Template content
 * @requires --allow-read Permission to read template files
 */
export async function readTemplate(filename: string): Promise<string> {
  return await readAsset(`templates/${filename}`);
}

/**
 * Read asset file (help text, etc.)
 *
 * @param path - Asset filename (e.g., "usage.txt", "usage-run.txt")
 * @returns Asset content
 * @requires --allow-read Permission to read asset files
 */
export async function readAsset(path: string): Promise<string> {
  const assetPath = new URL(
    `../assets/${path}`,
    import.meta.url,
  );
  const resp = await fetch(assetPath);
  return await resp.text();
}

/**
 * Get version from import.meta.url
 *
 * @returns Version string from deno.jsonc or "unknown" if unable to read
 */
export function getVersion(): string {
  const prefix = "https://jsr.io/@lambdalisue/probitas/";
  if (import.meta.url.startsWith(prefix)) {
    return import.meta.url.slice(prefix.length).split("/").at(0) ?? "unknown";
  }
  return "unknown";
}

/**
 * Check if a scenario matches a single selector
 *
 * @param scenario - Scenario definition to check
 * @param selector - Selector to match against
 * @returns True if the scenario matches the selector
 */
function matchSelector(
  scenario: ScenarioDefinition,
  selector: Selector,
): boolean {
  const value = selector.value.toLowerCase();

  switch (selector.type) {
    case "tag":
      return scenario.options.tags.some((tag) =>
        tag.toLowerCase().includes(value)
      );

    case "name":
      return scenario.name.toLowerCase().includes(value);

    case "file":
      return scenario.location?.file?.toLowerCase().includes(value) || false;

    default:
      return false;
  }
}

/**
 * Apply selectors to filter scenarios
 *
 * Selector logic:
 * - Multiple selector strings: OR condition
 * - Comma-separated selectors: AND condition
 * - ! prefix: NOT condition
 *
 * @param scenarios - Scenario list
 * @param selectorStrings - Array of selector strings
 * @returns Filtered scenario list
 *
 * @example
 * // Select scenarios with "api" OR "db" tag
 * applySelectors(scenarios, ["tag:api", "tag:db"])
 *
 * // Select scenarios with "api" AND "critical" tag
 * applySelectors(scenarios, ["tag:api,tag:critical"])
 *
 * // Select "api" OR "db" tag, excluding "slow" tag
 * applySelectors(scenarios, ["tag:api,!tag:slow", "tag:db,!tag:slow"])
 */
export function applySelectors(
  scenarios: ScenarioDefinition[],
  selectorStrings: readonly string[],
): ScenarioDefinition[] {
  if (selectorStrings.length === 0) {
    return scenarios;
  }

  return scenarios.filter((scenario) => {
    // OR condition: true if matches any selector string
    return selectorStrings.some((selectorString) => {
      // Split by comma to get AND conditions
      const andSelectors = selectorString
        .split(",")
        .map((s) => parseSelector(s.trim()));

      // AND condition: must match all selectors
      return andSelectors.every((selector) => {
        const matches = matchSelector(scenario, selector);
        // Apply negation operator
        return selector.negated ? !matches : matches;
      });
    });
  });
}
