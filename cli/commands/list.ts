/**
 * Implementation of the `probitas list` command
 *
 * @module
 */

import { parseArgs } from "@std/cli";
import type { ScenarioDefinition } from "../../src/runner/types.ts";
import { EXIT_CODE } from "../constants.ts";
import { loadConfig } from "../config.ts";
import { loadScenarios } from "../loader.ts";
import type { ProbitasConfig } from "../types.ts";
import { applySelectors, discoverScenarioFiles, readAsset } from "../utils.ts";

/**
 * Options for the list command
 */
export interface ListCommandOptions {
  includes?: string[];
  excludes?: string[];
  selectors?: string[];
  json?: boolean;
  config?: string;
}

/**
 * Execute the list command
 *
 * @param args - Command-line arguments
 * @param cwd - Current working directory
 * @returns Exit code (0 = success, 2 = usage error)
 *
 * @requires --allow-read Permission to read config and scenario files
 */
export async function listCommand(
  args: string[],
  cwd: string,
): Promise<number> {
  try {
    // Parse command-line arguments
    const parsed = parseArgs(args, {
      string: ["config"],
      boolean: ["help", "json"],
      collect: ["selector", "include", "exclude"],
      alias: {
        h: "help",
        s: "selector",
      },
      default: {
        selector: [],
        include: [],
        exclude: [],
      },
    });

    // Show help if requested
    if (parsed.help) {
      try {
        const helpText = await readAsset("usage-list.txt");
        console.log(helpText);
        return EXIT_CODE.SUCCESS;
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        console.error(`Error reading help file: ${m}`);
        return EXIT_CODE.USAGE_ERROR;
      }
    }

    // Read environment variables (lower priority than CLI args)
    const envConfig = {
      config: Deno.env.get("PROBITAS_CONFIG"),
    };

    // Priority: CLI args > env vars > defaults
    const options: ListCommandOptions = {
      includes: parsed.include as string[],
      excludes: parsed.exclude as string[],
      selectors: parsed.selector as string[],
      json: parsed.json,
      config: parsed.config || envConfig.config,
    };

    // Load configuration
    const config = await loadConfig(cwd, options.config);
    const mergedConfig = (config ?? {}) as ProbitasConfig;

    // Merge include/exclude patterns with priority: CLI > config > defaults
    const includePatterns = options.includes?.length
      ? options.includes
      : mergedConfig.includes ?? ["**/*.scenario.ts"];
    const excludePatterns = options.excludes?.length
      ? options.excludes
      : mergedConfig.excludes ?? ["**/node_modules/**", "**/.git/**"];

    // Prepare paths (default to current directory if empty)
    const files = parsed._ as string[];
    const paths = files.length === 0 ? ["."] : files;

    // Discover scenario files (filter to string patterns only)
    const stringIncludePatterns = includePatterns.filter((p): p is string =>
      typeof p === "string"
    );
    const stringExcludePatterns = excludePatterns.filter((p): p is string =>
      typeof p === "string"
    );
    // If no string patterns, use default
    const finalIncludePatterns = stringIncludePatterns.length > 0
      ? stringIncludePatterns
      : ["**/*.scenario.ts"];
    const discoveredFiles = await discoverScenarioFiles(
      paths,
      finalIncludePatterns,
      stringExcludePatterns,
    );

    // Load scenarios from discovered files
    const scenarios = await loadScenarios(cwd, {
      includes: discoveredFiles as (string | RegExp)[],
      excludes: mergedConfig.excludes,
    });

    // Apply selectors to filter scenarios
    const selectors = options.selectors && options.selectors.length > 0
      ? options.selectors
      : mergedConfig.selectors || [];

    const filteredScenarios = applySelectors(scenarios, selectors);

    // Output results
    if (options.json) {
      outputJson(filteredScenarios);
    } else {
      outputText(scenarios, filteredScenarios);
    }

    return EXIT_CODE.SUCCESS;
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected error: ${m}`);
    return EXIT_CODE.USAGE_ERROR;
  }
}

/**
 * Output scenarios in text format
 *
 * @param allScenarios - All scenarios (to group by file)
 * @param filteredScenarios - Filtered scenarios to display
 */
function outputText(
  allScenarios: ScenarioDefinition[],
  filteredScenarios: ScenarioDefinition[],
): void {
  // Group scenarios by file
  const byFile = new Map<string, ScenarioDefinition[]>();

  for (const scenario of allScenarios) {
    const file = scenario.location?.file || "unknown";
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(scenario);
  }

  // Output grouped scenarios
  let outputCount = 0;
  for (const [file, scenariosInFile] of byFile) {
    console.log(file);
    for (const scenario of scenariosInFile) {
      if (filteredScenarios.includes(scenario)) {
        console.log(`  ${scenario.name}`);
        outputCount++;
      }
    }
  }

  console.log(
    `\nTotal: ${outputCount} scenario${
      outputCount === 1 ? "" : "s"
    } in ${byFile.size} file${byFile.size === 1 ? "" : "s"}`,
  );
}

/**
 * Output scenarios in JSON format
 *
 * @param scenarios - Scenarios to output
 */
function outputJson(scenarios: ScenarioDefinition[]): void {
  const output = scenarios.map((scenario) => ({
    name: scenario.name,
    tags: scenario.options.tags,
    steps: scenario.steps.length,
    file: scenario.location?.file || "unknown",
  }));

  console.log(JSON.stringify(output, null, 2));
}
