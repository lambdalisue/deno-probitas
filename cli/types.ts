/**
 * Type definitions for the CLI module
 *
 * @module
 */

import type { Reporter, RunOptions } from "../src/runner/types.ts";

/**
 * Selector type for filtering scenarios
 */
export type SelectorType = "tag" | "name" | "file";

/**
 * Selector for filtering scenarios
 *
 * Examples:
 *   "tag:smoke" -> { type: "tag", value: "smoke", negated: false }
 *   "!tag:slow" -> { type: "tag", value: "slow", negated: true }
 *   "!wip" -> { type: "name", value: "wip", negated: true }
 */
export interface Selector {
  /** Type of selector */
  readonly type: SelectorType;

  /** Value to match */
  readonly value: string;

  /** Negation flag */
  readonly negated: boolean;
}

/**
 * Parse selector string into Selector object
 *
 * Examples:
 *   "tag:smoke" -> { type: "tag", value: "smoke", negated: false }
 *   "!tag:slow" -> { type: "tag", value: "slow", negated: true }
 *   "!wip" -> { type: "name", value: "wip", negated: true }
 *
 * @param selector - Selector string
 * @returns Parsed Selector object
 */
export function parseSelector(selector: string): Selector {
  let negated = false;
  let input = selector.trim();

  // Check negation prefix (support multiple ! for double negation)
  while (input.startsWith("!")) {
    negated = !negated;
    input = input.slice(1).trim();
  }

  // Parse type:value format
  const colonIndex = input.indexOf(":");
  if (colonIndex !== -1) {
    const type = input.slice(0, colonIndex).trim();
    const value = input.slice(colonIndex + 1).trim();

    if (type === "tag" || type === "name" || type === "file") {
      return { type, value, negated };
    }
  }

  // Default to name type
  return { type: "name", value: input, negated };
}

/**
 * ProbitasConfig - Configuration type for CLI
 *
 * Extends RunOptions with CLI-specific settings for file patterns and reporter names.
 */
export interface ProbitasConfig
  extends Omit<RunOptions, "reporter" | "signal"> {
  /** Include patterns (glob, file, directory, or RegExp) */
  readonly includes?: (string | RegExp)[];

  /** Exclude patterns (glob, file, directory, or RegExp) */
  readonly excludes?: (string | RegExp)[];

  /** Reporter (string name or Reporter instance) */
  readonly reporter?: string | Reporter;

  /** Selectors for filtering scenarios (CLI-specific) */
  readonly selectors?: readonly string[];

  /** Exclude selectors for filtering scenarios (CLI-specific) */
  readonly excludeSelectors?: readonly string[];
}
