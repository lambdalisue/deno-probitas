/**
 * Type definitions for the CLI module
 *
 * @module
 */

import type { DefaultStepOptions } from "../src/runner/types.ts";

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
 * Probitas configuration
 * Loaded from deno.json/deno.jsonc
 */
export interface ProbitasConfig {
  /** Default reporter */
  readonly reporter?: "dot" | "list" | "json" | "tap";

  /** File discovery patterns (glob) */
  readonly includes?: string[];

  /** Exclude patterns (glob) */
  readonly excludes?: string[];

  /** Default selectors */
  readonly selectors?: string[];

  /** Maximum concurrent scenarios */
  readonly maxConcurrency?: number;

  /** Maximum failures before stopping */
  readonly maxFailures?: number;

  /** Default step options applied to all steps */
  readonly stepOptions?: DefaultStepOptions;
}
