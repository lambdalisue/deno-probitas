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

import { as, ensure, is, type Predicate } from "@core/unknownutil";
import { ScenarioRunner } from "../../src/runner/scenario_runner.ts";
import type { ReporterOptions } from "../../src/reporter/types.ts";
import type { DefaultStepOptions } from "../../src/runner/types.ts";
import { loadScenarios } from "../loader.ts";
import { ConsoleSuppressor } from "../console_suppressor.ts";
import { applySelectors, resolveReporter } from "../utils.ts";

/**
 * Input configuration passed via stdin
 */
export interface SubprocessInput {
  /** Absolute paths to scenario files */
  readonly files: string[];

  /** Selectors to filter scenarios */
  readonly selectors?: string[];

  /** Reporter name */
  readonly reporter?: string;

  /** Maximum concurrent scenarios */
  readonly maxConcurrency?: number;

  /** Maximum number of failures before stopping */
  readonly maxFailures?: number;

  /** Default step options */
  readonly stepOptions?: DefaultStepOptions;

  /** Disable color output */
  readonly noColor?: boolean;
}

export const isSubprocessInput = is.ObjectOf({
  files: as.Readonly(is.ArrayOf(is.String)),
  selectors: as.Readonly(as.Optional(is.ArrayOf(is.String))),
  reporter: as.Readonly(as.Optional(is.String)),
  maxConcurrency: as.Readonly(as.Optional(is.Number)),
  maxFailures: as.Readonly(as.Optional(is.Number)),
  stepOptions: as.Readonly(as.Optional(is.ObjectOf({
    timeout: as.Readonly(as.Optional(is.Number)),
    retry: as.Readonly(as.Optional(is.ObjectOf({
      maxAttempts: as.Readonly(as.Optional(is.Number)),
      backoff: as.Readonly(
        as.Optional(is.LiteralOneOf(["linear", "exponential"] as const)),
      ),
    }))),
  }))),
  noColor: as.Readonly(as.Optional(is.Boolean)),
}) satisfies Predicate<SubprocessInput>;

async function main(): Promise<number> {
  // Apply console suppression (normal level)
  using _consoleSuppressor = new ConsoleSuppressor("normal");

  const response = new Response(Deno.stdin.readable);
  const input = ensure(await response.json(), isSubprocessInput);
  const {
    files,
    selectors,
    reporter: reporterName,
    noColor,
    maxConcurrency,
    maxFailures,
    stepOptions,
  } = input;

  if (files.length === 0) {
    console.error("Error: No scenario files specified");
    return 1;
  }

  try {
    // Load scenarios from absolute paths
    const scenarios = await loadScenarios(files, {
      onLoadError: (path, err) => {
        console.warn(`Failed to load scenario file "${path}": ${err}`);
      },
    });
    if (scenarios.length === 0) {
      console.error("Error: No scenarios found in specified files");
      return 4; // NOT_FOUND
    }

    // Apply selectors to filter scenarios
    const filteredScenarios = applySelectors(scenarios, selectors ?? []);
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
