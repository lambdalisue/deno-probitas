/**
 * Tests for cli/main.ts
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { EXIT_CODE } from "./constants.ts";
import { main } from "./main.ts";

describe("main", { permissions: { read: true, write: true } }, () => {
  describe("verbosity flags", () => {
    const verbosityFlags = [
      ["-q", "quiet (short)"],
      ["--quiet", "quiet (long)"],
      ["-v", "verbose (short)"],
      ["--verbose", "verbose (long)"],
      ["-d", "debug (short)"],
      ["--debug", "debug (long)"],
    ] as const;

    verbosityFlags.forEach(([flag, name]) => {
      it(`accepts ${name} flag`, async () => {
        const tempDir = await Deno.makeTempDir();
        const originalCwd = Deno.cwd();
        try {
          await Deno.chdir(tempDir);
          const exitCode = await main([flag, "list"]);
          assertEquals(typeof exitCode, "number");
        } finally {
          await Deno.chdir(originalCwd);
          await Deno.remove(tempDir, { recursive: true });
        }
      });
    });
  });

  describe("help and version flags", () => {
    const helpFlags: Array<[string[], string]> = [
      [[], "no arguments"],
      [["-h"], "-h flag"],
      [["--help"], "--help flag"],
    ];

    helpFlags.forEach(([args, name]) => {
      it(`shows help with ${name}`, async () => {
        const output: string[] = [];
        using _logStub = stub(console, "log", (...args: unknown[]) => {
          output.push(args.join(" "));
        });

        const exitCode = await main(args);

        assertEquals(exitCode, EXIT_CODE.SUCCESS);
        assertEquals(output.length, 1);
        assertEquals(output[0].includes("Usage:"), true);
      });
    });

    const versionFlags: Array<[string[], string]> = [
      [["-V"], "-V flag"],
      [["--version"], "--version flag"],
    ];

    versionFlags.forEach(([args, name]) => {
      it(`shows version with ${name}`, async () => {
        const output: string[] = [];
        using _logStub = stub(console, "log", (...args: unknown[]) => {
          output.push(args.join(" "));
        });

        const exitCode = await main(args);

        assertEquals(exitCode, EXIT_CODE.SUCCESS);
        assertEquals(output.length, 1);
        assertEquals(output[0].startsWith("probitas"), true);
      });
    });
  });

  describe("command dispatch", () => {
    it("returns error for unknown command", async () => {
      const errors: string[] = [];
      using _errorStub = stub(console, "error", (...args: unknown[]) => {
        errors.push(args.join(" "));
      });

      const exitCode = await main(["unknown"]);

      assertEquals(exitCode, EXIT_CODE.USAGE_ERROR);
      assertEquals(errors.length, 2);
      assertEquals(errors[0].includes("Unknown command"), true);
    });
  });
});
