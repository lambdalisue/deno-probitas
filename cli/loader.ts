/**
 * Scenario file loader for Probitas
 *
 * @module
 */

import { toFileUrl } from "@std/path";
import type { ScenarioDefinition } from "../src/runner/types.ts";

/**
 * Options for loading scenarios
 */
export interface LoadScenarioOptions {
  readonly onLoadError: (path: string, err: unknown) => void;
}

/**
 * Load scenarios from files matching the given patterns
 *
 * @param cwd - Current working directory
 * @param options - Load options with includes/excludes patterns
 * @returns Array of loaded ScenarioDefinition objects
 *
 * @requires --allow-read Permission to read scenario files
 */
export async function loadScenarios(
  paths: string[],
  { onLoadError }: LoadScenarioOptions,
): Promise<ScenarioDefinition[]> {
  const scenarios = await Promise.all(
    paths.map(async (path): Promise<ScenarioDefinition[]> => {
      try {
        const fileUrl = toFileUrl(path);
        const module = await import(fileUrl.href);
        const exported = module.default;

        if (Array.isArray(exported)) {
          // Multiple scenarios
          return exported;
        } else if (exported && typeof exported === "object") {
          // Single scenario
          return [exported];
        }
      } catch (err: unknown) {
        onLoadError?.(path, err);
      }
      return [];
    }),
  );
  return scenarios.flat();
}
