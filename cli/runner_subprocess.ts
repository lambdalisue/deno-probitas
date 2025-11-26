/**
 * Subprocess entry point for running scenarios
 *
 * Receives configuration as JSON via stdin and executes scenarios
 * in isolation from the main CLI process.
 *
 * @module
 *
 * @requires --allow-read Permission to read scenario files
 */

import { toFileUrl } from "@std/path";
import { ScenarioRunner } from "../src/runner/scenario_runner.ts";
import type { ReporterOptions } from "../src/reporter/types.ts";
import type { DefaultStepOptions } from "../src/runner/types.ts";
import { ConsoleSuppressor } from "./console_suppressor.ts";
import { applySelectors, resolveReporter } from "./utils.ts";

/**
 * Input configuration passed via stdin
 */
interface SubprocessInput {
  /** Absolute paths to scenario files */
  files: string[];

  /** Selectors to filter scenarios */
  selectors?: string[];

  /** Reporter name */
  reporter?: string;

  /** Disable color output */
  noColor?: boolean;

  /** Maximum concurrent scenarios */
  maxConcurrency?: number;

  /** Maximum number of failures before stopping */
  maxFailures?: number;

  /** Default step options */
  stepOptions?: DefaultStepOptions;
}

/**
 * Load scenarios from absolute file paths
 *
 * @param filePaths - Array of absolute file paths
 * @returns Array of loaded scenario definitions
 * @throws Error if unable to load a file
 */
async function loadScenariosFromPaths(
  filePaths: string[],
) {
  const scenarios = [];

  for (const filePath of filePaths) {
    try {
      const fileUrl = toFileUrl(filePath);
      // deno-lint-ignore no-explicit-any
      const module = await import(fileUrl.href) as any;
      const exported = module.default;

      if (Array.isArray(exported)) {
        scenarios.push(...exported);
      } else if (exported && typeof exported === "object") {
        scenarios.push(exported);
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load scenario from ${filePath}: ${m}`);
    }
  }

  return scenarios;
}

async function main(): Promise<number> {
  // Apply console suppression (normal level)
  using _consoleSuppressor = new ConsoleSuppressor("normal");

  // Read JSON configuration from stdin
  let input: SubprocessInput;
  try {
    const response = await new Response(Deno.stdin.readable);
    const text = await response.text();
    input = JSON.parse(text);
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to parse stdin JSON: ${m}`);
    return 1;
  }

  const {
    files,
    selectors,
    reporter: reporterName,
    noColor,
    maxConcurrency,
    maxFailures,
    stepOptions,
  } = input;

  if (!files || files.length === 0) {
    console.error("Error: No scenario files specified");
    return 1;
  }

  try {
    // Load scenarios from absolute paths
    const scenarios = await loadScenariosFromPaths(files);

    if (scenarios.length === 0) {
      console.error("Error: No scenarios found in specified files");
      return 4; // NOT_FOUND
    }

    // Apply selectors to filter scenarios
    let filteredScenarios = scenarios;
    if (selectors && selectors.length > 0) {
      filteredScenarios = applySelectors(scenarios, selectors);
    }

    if (filteredScenarios.length === 0) {
      console.error("Error: No scenarios matched the filter");
      return 4; // NOT_FOUND
    }

    // Setup reporter
    const reporterOptions: ReporterOptions = { noColor: noColor ?? false };
    const reporter = resolveReporter(reporterName, reporterOptions);

    // Execute scenarios
    const runner = new ScenarioRunner();
    const summary = await runner.run(filteredScenarios, {
      reporter,
      maxConcurrency,
      maxFailures,
      stepOptions,
    });

    // Return exit code
    return summary.failed > 0 ? 1 : 0;
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${m}`);
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await main();
  Deno.exit(exitCode);
}
