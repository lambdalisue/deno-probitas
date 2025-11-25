/**
 * CLI entry point for Probitas
 *
 * @module
 */

import { parseArgs } from "@std/cli";
import { EXIT_CODE } from "./constants.ts";
import { ConsoleSuppressor, type Verbosity } from "./console_suppressor.ts";
import { initCommand } from "./commands/init.ts";
import { listCommand } from "./commands/list.ts";
import { runCommand } from "./commands/run.ts";
import { getVersion, readAsset } from "./utils.ts";

// Global option flags
const GLOBAL_OPTION_FLAGS = [
  "-q",
  "--quiet",
  "-v",
  "--verbose",
  "-d",
  "--debug",
] as const;

type GlobalOptionFlag = typeof GLOBAL_OPTION_FLAGS[number];

/**
 * Partition arguments into global and local options
 *
 * @param args - Command-line arguments
 * @returns Object with globalArgs and localArgs arrays
 */
function partitionArgs(args: string[]): {
  globalArgs: string[];
  localArgs: string[];
} {
  const globalArgs: string[] = [];
  const localArgs: string[] = [];

  for (const arg of args) {
    if (GLOBAL_OPTION_FLAGS.includes(arg as GlobalOptionFlag)) {
      globalArgs.push(arg);
    } else {
      localArgs.push(arg);
    }
  }

  return { globalArgs, localArgs };
}

/**
 * Extract verbosity level from parsed options
 *
 * Priority: debug > verbose > quiet > normal (default)
 *
 * @param options - Parsed options object
 * @returns Verbosity level
 */
function extractVerbosity(options: {
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
}): Verbosity {
  if (options.debug) return "debug";
  if (options.verbose) return "verbose";
  if (options.quiet) return "quiet";
  return "normal";
}

/**
 * Main CLI handler
 *
 * Dispatches to appropriate command handler based on command name.
 *
 * @param args - Command-line arguments
 * @returns Exit code
 *
 * @requires --allow-read For loading config and scenario files
 * @requires --allow-write For init command
 */
export async function main(args: string[]): Promise<number> {
  const cwd = Deno.cwd();

  // Partition arguments into global and local options
  const { globalArgs, localArgs } = partitionArgs(args);

  // Parse global options
  const globalOpts = parseArgs(globalArgs, {
    boolean: ["quiet", "verbose", "debug"],
    alias: {
      q: "quiet",
      v: "verbose",
      d: "debug",
    },
  });

  // Parse local options (help, version, and command)
  const localOpts = parseArgs(localArgs, {
    boolean: ["help", "version"],
    alias: {
      h: "help",
      V: "version",
    },
    stopEarly: true,
  });

  // Show version (before applying console suppression)
  if (localOpts.version) {
    const version = getVersion();
    console.log(`probitas ${version}`);
    return EXIT_CODE.SUCCESS;
  }

  // Show help (no command specified or --help flag) before applying console suppression
  if (localOpts.help || localOpts._.length === 0) {
    try {
      const helpText = await readAsset("usage.txt");
      console.log(helpText);
      return EXIT_CODE.SUCCESS;
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error(`Error reading help file: ${m}`);
      return EXIT_CODE.USAGE_ERROR;
    }
  }

  // Apply console suppression with using syntax
  using _consoleSuppressor = new ConsoleSuppressor(
    extractVerbosity(globalOpts),
  );

  // Get command and its arguments
  const command = String(localOpts._[0]);
  const commandArgs = localOpts._.slice(1).map(String);

  // Dispatch to command handler
  switch (command) {
    case "run":
      return await runCommand(commandArgs, cwd);

    case "list":
      return await listCommand(commandArgs, cwd);

    case "init":
      return await initCommand(commandArgs, cwd);

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'probitas --help' for usage information");
      return EXIT_CODE.USAGE_ERROR;
  }
}
