/**
 * Implementation of the `probitas run` command
 *
 * @module
 */

import { is, maybe } from "@core/unknownutil";
import { parseArgs } from "@std/cli";
import { resolve } from "@std/path";
import { EXIT_CODE } from "../constants.ts";
import { loadConfig } from "../config.ts";
import type { SubprocessInput } from "../subprocess/runner.ts";
import {
  discoverScenarioFiles,
  findDenoConfigFile,
  getVersion,
  parseMaxConcurrency,
  parseMaxFailures,
  readAsset,
  readTemplate,
} from "../utils.ts";

const RUNNER_URL = new URL(
  "../subprocess/runner.ts",
  import.meta.url,
);

const isStringArray = is.ArrayOf(is.String);

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
  await using stack = new AsyncDisposableStack();

  try {
    // Parse command-line arguments
    const parsed = parseArgs(args, {
      string: ["reporter", "config", "max-concurrency", "max-failures"],
      boolean: [
        "help",
        "no-color",
        "sequential",
        "fail-fast",
      ],
      collect: ["selector", "include", "exclude"],
      alias: {
        h: "help",
        s: "selector",
        S: "sequential",
        f: "fail-fast",
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

    // Load configuration
    const configPath = parsed.config ??
      Deno.env.get("PROBITAS_CONFIG") ??
      findDenoConfigFile(cwd);
    const config = configPath ? await loadConfig(configPath) : null;

    // Merge include/exclude patterns with priority: CLI > config > defaults
    const includes = maybe(parsed.include, isStringArray) ??
      config?.includes ??
      ["**/*.scenario.ts"];
    const excludes = maybe(parsed.exclude, isStringArray) ??
      config?.excludes ??
      ["**/node_modules/**", "**/.git/**"];

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
    if (discoveredFiles.length === 0) {
      console.error("No scenarios found");
      return EXIT_CODE.NOT_FOUND;
    }

    const selectors = maybe(parsed.selector, isStringArray) ??
      config?.selectors ??
      [];
    const reporter = parsed.reporter ?? config?.reporter;
    const maxConcurrency = parsed.sequential
      ? 1
      : parseMaxConcurrency(parsed["max-concurrency"]) ??
        config?.maxConcurrency;
    const maxFailures = parsed["fail-fast"]
      ? 1
      : parseMaxFailures(parsed["max-failures"]) ?? config?.maxFailures;

    let configPathApplied = configPath;
    if (!configPathApplied) {
      // Create temporary deno.jsonc from template
      const tmp = await Deno.makeTempFile({ suffix: ".jsonc" });
      stack.defer(async () => {
        try {
          await Deno.remove(tmp);
        } catch {
          // Ignore cleanup errors
        }
      });

      const version = getVersion();
      const versionSpec = version === "unknown" ? "" : `@^${version}`;
      const template = await readTemplate("deno.jsonc");
      const content = template.replace("{{VERSION}}", versionSpec);
      await Deno.writeTextFile(tmp, content);
      configPathApplied = tmp;
    }

    // Prepare subprocess command arguments
    const subprocessArgs = [
      "run",
      "-A",
      "--config",
      configPathApplied,
      RUNNER_URL.href,
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
      new TextEncoder().encode(JSON.stringify(
        {
          files: discoveredFiles,
          selectors,
          reporter,
          maxConcurrency,
          maxFailures,
          noColor: parsed["no-color"] ?? Deno.env.has("NO_COLOR"),
        } satisfies SubprocessInput,
      )),
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
