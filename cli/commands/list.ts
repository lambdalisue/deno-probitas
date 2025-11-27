/**
 * Implementation of the `probitas list` command
 *
 * @module
 */

import { is, maybe } from "@core/unknownutil";
import { parseArgs } from "@std/cli";
import { resolve } from "@std/path";
import type { ScenarioDefinition } from "../../src/runner/types.ts";
import { EXIT_CODE } from "../constants.ts";
import { loadConfig } from "../config.ts";
import { loadScenarios } from "../loader.ts";
import {
  applySelectors,
  discoverScenarioFiles,
  findDenoConfigFile,
  readAsset,
} from "../utils.ts";

const isStringArray = is.ArrayOf(is.String);

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
    });
    console.debug(`parsed: ${JSON.stringify(parsed, null, 2)}`);

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

    // Load configuration
    const configPath = parsed.config ??
      Deno.env.get("PROBITAS_CONFIG") ??
      findDenoConfigFile(cwd);
    console.debug(`configPath: ${configPath}`);
    const config = configPath ? await loadConfig(configPath) : null;
    console.debug(`config: ${JSON.stringify(config, null, 2)}`);

    // Merge include/exclude patterns with priority: CLI > config > defaults
    const includes = maybe(parsed.include, isStringArray) ??
      config?.includes ??
      ["**/*.scenario.ts"];
    console.debug(`includes: ${includes}`);
    const excludes = maybe(parsed.exclude, isStringArray) ??
      config?.excludes ??
      ["**/node_modules/**", "**/.git/**"];
    console.debug(`excludes: ${excludes}`);

    // Discover scenario files
    const paths = (parsed._.length > 0 ? parsed._ : ["."])
      .filter(is.String)
      .map((v) => resolve(cwd, v));
    console.debug(`paths: ${paths}`);
    const discoveredFiles = await discoverScenarioFiles(
      paths,
      includes,
      excludes,
    );
    console.debug(`Discovered scenario files: ${discoveredFiles}`);

    // Load scenarios from discovered files
    const scenarios = await loadScenarios(discoveredFiles, {
      onLoadError: (path, err) => {
        console.warn(`Failed to load scenario file "${path}": ${err}`);
      },
    });

    // Merge selectors with priority: CLI > config > defaults
    const selectors = maybe(parsed.selector, isStringArray) ??
      config?.selectors ??
      [];

    // Apply selectors to filter scenarios
    const filteredScenarios = applySelectors(
      scenarios,
      selectors,
    );

    // Output results
    if (parsed.json) {
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
    console.info(file);
    for (const scenario of scenariosInFile) {
      if (filteredScenarios.includes(scenario)) {
        console.info(`  ${scenario.name}`);
        outputCount++;
      }
    }
    console.info();
  }

  console.info(
    `Total: ${outputCount} scenario${
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

  console.info(JSON.stringify(output, null, 2));
}
