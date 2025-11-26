/**
 * Implementation of the `probitas run` command
 *
 * @module
 */

import { parseArgs } from "@std/cli";
import { resolve } from "@std/path";
import { ScenarioRunner } from "../../src/runner/scenario_runner.ts";
import type { Reporter, RunOptions } from "../../src/runner/types.ts";
import type { ReporterOptions } from "../../src/reporter/types.ts";
import { EXIT_CODE } from "../constants.ts";
import { loadConfig } from "../config.ts";
import { loadScenarios } from "../loader.ts";
import type { ProbitasConfig } from "../types.ts";
import {
  applySelectors,
  discoverScenarioFiles,
  findDenoConfigFile,
  parseMaxConcurrency,
  parseMaxFailures,
  readAsset,
  resolveReporter,
} from "../utils.ts";

/**
 * Options for the run command
 */
export interface RunCommandOptions {
  files?: string[];
  includes?: string[];
  excludes?: string[];
  selectors?: string[];
  reporter?: string;
  maxConcurrency?: string | number;
  maxFailures?: string | number;
  noColor?: boolean;
  config?: string;
}

/**
 * Execute the run command
 *
 * @param args - Command-line arguments
 * @param cwd - Current working directory
 * @returns Exit code (0 = success, 1 = failure, 2 = usage error)
 *
 * @requires --allow-read Permission to read config and scenario files
 */
export async function runCommand(
  args: string[],
  cwd: string,
): Promise<number> {
  try {
    // Parse command-line arguments
    const parsed = parseArgs(args, {
      string: ["reporter", "config", "max-concurrency", "max-failures"],
      boolean: [
        "help",
        "no-color",
        "quiet",
        "verbose",
        "debug",
        "sequential",
        "fail-fast",
      ],
      collect: ["selector", "include", "exclude"],
      alias: {
        h: "help",
        s: "selector",
        S: "sequential",
        f: "fail-fast",
        v: "verbose",
        q: "quiet",
        d: "debug",
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
        const helpText = await readAsset("usage-run.txt");
        console.log(helpText);
        return EXIT_CODE.SUCCESS;
      } catch (error) {
        console.error(
          "Error reading help file:",
          error instanceof Error ? error.message : String(error),
        );
        return EXIT_CODE.USAGE_ERROR;
      }
    }

    const files = parsed._;

    // Read environment variables (lower priority than CLI args)
    const noColor = Deno.env.get("NO_COLOR") !== undefined;

    // Priority: CLI args > env vars > defaults
    const options: RunCommandOptions = {
      files: files.length > 0 ? files.map(String) : undefined,
      includes: parsed.include as string[],
      excludes: parsed.exclude as string[],
      selectors: parsed.selector as string[],
      reporter: parsed.reporter,
      maxConcurrency: parsed.sequential ? 1 : parsed["max-concurrency"],
      maxFailures: parsed["fail-fast"] ? 1 : parsed["max-failures"],
      noColor: parsed["no-color"] || noColor,
      config: parsed.config,
    };

    // Determine config file path (priority: --config > env > auto search)
    const configPath =
      (options.config ? resolve(cwd, options.config) : undefined) ??
        (Deno.env.get("PROBITAS_CONFIG")
          ? resolve(cwd, Deno.env.get("PROBITAS_CONFIG")!)
          : undefined) ??
        findDenoConfigFile(cwd);

    // Load configuration
    let mergedConfig: ProbitasConfig = {};
    if (configPath) {
      mergedConfig = await loadConfig(configPath);
    }

    // Merge include/exclude patterns with priority: CLI > config > defaults
    const includePatterns = options.includes?.length
      ? options.includes
      : mergedConfig.includes ?? ["**/*.scenario.ts"];
    const excludePatterns = options.excludes?.length
      ? options.excludes
      : mergedConfig.excludes ?? ["**/node_modules/**", "**/.git/**"];

    // Prepare paths (use CLI files or default to current directory)
    const paths = options.files && options.files.length > 0
      ? options.files
      : ["."];

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

    // If no files discovered, return early
    if (discoveredFiles.length === 0) {
      console.error("No scenarios found");
      return EXIT_CODE.NOT_FOUND;
    }

    // Load scenarios from discovered files
    const scenarios = await loadScenarios(cwd, {
      includes: discoveredFiles as (string | RegExp)[],
      excludes: mergedConfig.excludes,
    });

    if (scenarios.length === 0) {
      console.error("No scenarios found");
      return EXIT_CODE.NOT_FOUND;
    }

    // Apply selectors to filter scenarios
    const selectors = options.selectors && options.selectors.length > 0
      ? options.selectors
      : mergedConfig.selectors || [];

    const filteredScenarios = applySelectors(scenarios, selectors);

    if (filteredScenarios.length === 0) {
      console.error("No scenarios matched the filter");
      return EXIT_CODE.NOT_FOUND;
    }

    // Build run options
    const reporterOptions: ReporterOptions = {
      noColor: options.noColor,
    };

    let reporter: Reporter;
    if (options.reporter) {
      reporter = resolveReporter(options.reporter, reporterOptions);
    } else if (mergedConfig.reporter) {
      if (typeof mergedConfig.reporter === "string") {
        reporter = resolveReporter(mergedConfig.reporter, reporterOptions);
      } else {
        reporter = mergedConfig.reporter;
      }
    } else {
      reporter = resolveReporter("list", reporterOptions);
    }

    let runOptions: RunOptions = {
      reporter,
    };

    // Set maxConcurrency
    if (options.maxConcurrency) {
      try {
        const concurrency = parseMaxConcurrency(options.maxConcurrency);
        runOptions = {
          ...runOptions,
          maxConcurrency: concurrency,
        };
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : String(error),
        );
        return EXIT_CODE.USAGE_ERROR;
      }
    } else if (mergedConfig.maxConcurrency) {
      runOptions = {
        ...runOptions,
        maxConcurrency: mergedConfig.maxConcurrency,
      };
    }

    // Set maxFailures
    if (options.maxFailures) {
      try {
        const count = parseMaxFailures(options.maxFailures);
        if (count !== undefined) {
          runOptions = {
            ...runOptions,
            maxFailures: count,
          };
        }
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : String(error),
        );
        return EXIT_CODE.USAGE_ERROR;
      }
    } else if (mergedConfig.maxFailures) {
      runOptions = {
        ...runOptions,
        maxFailures: mergedConfig.maxFailures,
      };
    }

    // Run scenarios
    const runner = new ScenarioRunner();
    const summary = await runner.run(filteredScenarios, runOptions);

    // Return exit code
    return summary.failed > 0 ? EXIT_CODE.FAILURE : EXIT_CODE.SUCCESS;
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected error: ${m}`);
    return EXIT_CODE.USAGE_ERROR;
  }
}
