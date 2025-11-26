/**
 * Implementation of the `probitas run` command
 *
 * @module
 */

import { parseArgs } from "@std/cli";
import { resolve } from "@std/path";
import type { DefaultStepOptions } from "../../src/runner/types.ts";
import { EXIT_CODE } from "../constants.ts";
import { loadConfig } from "../config.ts";
import type { ProbitasConfig } from "../types.ts";
import {
  discoverScenarioFiles,
  findDenoConfigFile,
  getVersion,
  parseMaxConcurrency,
  parseMaxFailures,
  readAsset,
  readTemplate,
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
 * Subprocess input configuration
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
 * Execute the run command
 *
 * @param args - Command-line arguments
 * @param cwd - Current working directory
 * @returns Exit code (0 = success, 1 = failure, 2 = usage error)
 *
 * @requires --allow-read Permission to read config and scenario files
 * @requires --allow-run Permission to run subprocess
 * @requires --allow-write Permission to create temporary config files
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
    const relativePaths = options.files && options.files.length > 0
      ? options.files
      : ["."];
    // Resolve paths relative to cwd
    const paths = relativePaths.map((p) => resolve(cwd, p));

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

    if (discoveredFiles.length === 0) {
      console.error("No scenarios found");
      return EXIT_CODE.NOT_FOUND;
    }

    // Apply selectors to filter scenarios
    const selectors = options.selectors && options.selectors.length > 0
      ? options.selectors
      : mergedConfig.selectors || [];

    // Parse maxConcurrency
    let maxConcurrency: number | undefined;
    if (options.maxConcurrency) {
      try {
        maxConcurrency = parseMaxConcurrency(options.maxConcurrency);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : String(error),
        );
        return EXIT_CODE.USAGE_ERROR;
      }
    } else if (mergedConfig.maxConcurrency) {
      maxConcurrency = mergedConfig.maxConcurrency;
    }

    // Parse maxFailures
    let maxFailures: number | undefined;
    if (options.maxFailures) {
      try {
        maxFailures = parseMaxFailures(options.maxFailures);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : String(error),
        );
        return EXIT_CODE.USAGE_ERROR;
      }
    } else if (mergedConfig.maxFailures) {
      maxFailures = mergedConfig.maxFailures;
    }

    // Determine reporter name
    const reporterName = options.reporter ?? mergedConfig.reporter ?? "list";

    // Prepare subprocess input
    const subprocessInput: SubprocessInput = {
      files: discoveredFiles,
      selectors: selectors.length > 0 ? selectors : undefined,
      reporter: typeof reporterName === "string" ? reporterName : "list",
      noColor: options.noColor,
      maxConcurrency,
      maxFailures,
      stepOptions: mergedConfig.stepOptions,
    };

    // Get subprocess path
    const subprocessPath = new URL(
      "../runner_subprocess.ts",
      import.meta.url,
    ).pathname;

    // Find or create deno.json
    // Priority: CLI --config > env PROBITAS_CONFIG > auto search
    const denoConfigPath = options.config
      ? resolve(cwd, options.config)
      : (Deno.env.get("PROBITAS_CONFIG")
        ? resolve(cwd, Deno.env.get("PROBITAS_CONFIG")!)
        : findDenoConfigFile(cwd));

    await using stack = new AsyncDisposableStack();

    let configFileToUse = denoConfigPath;

    if (!configFileToUse) {
      // Create temporary deno.jsonc from template
      const tempConfigPath = await Deno.makeTempFile({ suffix: ".jsonc" });

      stack.defer(async () => {
        try {
          await Deno.remove(tempConfigPath);
        } catch {
          // Ignore cleanup errors
        }
      });

      const version = getVersion();
      const versionSpec = version === "unknown" ? "" : `@^${version}`;
      const template = await readTemplate("deno.jsonc");
      const content = template.replace("{{VERSION}}", versionSpec);

      await Deno.writeTextFile(tempConfigPath, content);
      configFileToUse = tempConfigPath;
    }

    // Prepare subprocess command arguments
    const subprocessArgs = [
      "run",
      "-A",
      "--config",
      configFileToUse,
      subprocessPath,
    ];

    // Start subprocess
    const cmd = new Deno.Command("deno", {
      args: subprocessArgs,
      cwd,
      stdin: "piped",
      stdout: "inherit",
      stderr: "inherit",
    });

    const child = cmd.spawn();

    // Send configuration via stdin
    const writer = child.stdin.getWriter();
    await writer.write(
      new TextEncoder().encode(JSON.stringify(subprocessInput)),
    );
    await writer.close();

    // Wait for subprocess to complete
    const result = await child.status;

    // Map exit codes
    if (result.code === 0) {
      return EXIT_CODE.SUCCESS;
    } else if (result.code === 4) {
      return EXIT_CODE.NOT_FOUND;
    } else {
      return EXIT_CODE.FAILURE;
    }
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected error: ${m}`);
    return EXIT_CODE.USAGE_ERROR;
  }
}
