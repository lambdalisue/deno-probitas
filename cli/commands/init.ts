/**
 * Implementation of the `probitas init` command
 *
 * @module
 */

import { parseArgs } from "@std/cli";
import { parse as parseJsonc } from "@std/jsonc";
import { resolve } from "@std/path";
import { EXIT_CODE } from "../constants.ts";
import {
  findDenoConfigFile,
  getVersion,
  readAsset,
  readTemplate,
} from "../utils.ts";
import { loadConfig } from "../config.ts";

/**
 * Options for the init command
 */
export interface InitCommandOptions {
  force?: boolean;
}

/**
 * Execute the init command
 *
 * @param args - Command-line arguments
 * @param cwd - Current working directory
 * @returns Exit code (0 = success, 2 = usage error)
 *
 * @requires --allow-write Permission to write config and scenario files
 */
export async function initCommand(
  args: string[],
  cwd: string,
): Promise<number> {
  try {
    // Parse command-line arguments
    const parsed = parseArgs(args, {
      boolean: ["help", "force"],
      alias: {
        h: "help",
        f: "force",
      },
    });

    // Show help if requested
    if (parsed.help) {
      try {
        const helpText = await readAsset("usage-init.txt");
        console.log(helpText);
        return EXIT_CODE.SUCCESS;
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        console.error(`Error reading help file: ${m}`);
        return EXIT_CODE.USAGE_ERROR;
      }
    }

    const options: InitCommandOptions = {
      force: parsed.force,
    };

    const version = getVersion();

    // Find existing deno.json/deno.jsonc
    let denoConfigPath = findDenoConfigFile(cwd);

    if (!denoConfigPath) {
      // deno.json doesn't exist → create new one
      denoConfigPath = resolve(cwd, "deno.jsonc");

      // Replace version placeholder
      const template = await readTemplate("deno.jsonc");
      const versionSpec = version === "unknown" ? "" : `@^${version}`;
      const content = template.replace("{{VERSION}}", versionSpec);

      await Deno.writeTextFile(denoConfigPath, content);
      console.log(`Created ${denoConfigPath}`);
    } else {
      // deno.json already exists → add/update probitas section

      // Check existing probitas configuration
      const existingConfig = await loadConfig(denoConfigPath);
      if (Object.keys(existingConfig).length > 0 && !options.force) {
        console.error(
          "probitas configuration already exists in deno.json. Use --force to overwrite.",
        );
        return EXIT_CODE.USAGE_ERROR;
      }

      // Read and parse existing file
      const fileContent = await Deno.readTextFile(denoConfigPath);
      const config = parseJsonc(fileContent) as Record<string, unknown>;

      // Update imports section
      if (!config.imports) {
        config.imports = {};
      }
      const imports = config.imports as Record<string, unknown>;
      if (!imports.probitas || typeof imports.probitas !== "string") {
        const versionSpec = version === "unknown" ? "" : `@^${version}`;
        imports.probitas = `jsr:@lambdalisue/probitas${versionSpec}`;
      }

      // Add probitas section
      config.probitas = {
        reporter: "list",
        includes: ["**/*.scenario.ts"],
        excludes: ["**/node_modules/**", "**/.git/**"],
      };

      // Write back
      await Deno.writeTextFile(
        denoConfigPath,
        JSON.stringify(config, null, 2) + "\n",
      );
      console.log(`Updated ${denoConfigPath}`);
    }

    // Create scenarios directory
    const scenariosDir = resolve(cwd, "scenarios");
    await Deno.mkdir(scenariosDir, { recursive: true });

    // Create scenarios/example.scenario.ts
    const examplePath = resolve(scenariosDir, "example.scenario.ts");
    const exampleContent = await readTemplate("example.scenario.ts");

    if (!options.force) {
      try {
        await Deno.stat(examplePath);
        console.error(
          "scenarios/example.scenario.ts already exists. Use --force to overwrite.",
        );
        return EXIT_CODE.USAGE_ERROR;
      } catch {
        // File doesn't exist, continue
      }
    }

    await Deno.writeTextFile(examplePath, exampleContent);
    console.log("Created scenarios/example.scenario.ts");

    console.log(
      "\nInitialization complete! Run 'probitas run' to execute the example scenario.",
    );

    return EXIT_CODE.SUCCESS;
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected error: ${m}`);
    return EXIT_CODE.USAGE_ERROR;
  }
}
