/**
 * Tests for configuration file loader
 *
 * @requires --allow-read Permission to read config files
 * @requires --allow-write Permission to write temporary test files
 * @module
 */

import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { defer } from "../src/helper/defer.ts";
import { loadConfig } from "./config.ts";
import type { ProbitasConfig } from "./types.ts";

describe("loadConfig", { permissions: { read: true, write: true } }, () => {
  it("loads from deno.json", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        reporter: "list",
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.reporter, "list");
  });

  it("loads from deno.jsonc", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.jsonc");
    const configContent = `{
  // Configuration comment
  "probitas": {
    "reporter": "dot"
  }
}`;
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.reporter, "dot");
  });

  it("parses probitas section", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      name: "my-project",
      version: "1.0.0",
      probitas: {
        reporter: "json",
        includes: ["**/*_test.ts", "tests/**/*.ts"],
        excludes: ["**/skip/**"],
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.reporter, "json");
    assertEquals(result.includes, ["**/*_test.ts", "tests/**/*.ts"]);
    assertEquals(result.excludes, ["**/skip/**"]);
  });

  it("validates reporter field", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");

    const testCases: Array<[unknown, boolean]> = [
      ["dot", true],
      ["list", true],
      ["json", true],
      ["tap", true],
      ["invalid", false],
      [123, false],
    ];

    for (const [reporter, shouldBeValid] of testCases) {
      const configContent = JSON.stringify({
        probitas: {
          reporter,
        },
      });
      await Deno.writeTextFile(configPath, configContent);

      const result = await loadConfig(configPath);
      if (shouldBeValid) {
        assertEquals(result.reporter, reporter);
      } else {
        assertEquals(result.reporter, undefined);
      }
    }
  });

  it("validates includes field", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        includes: ["**/*.test.ts", "**/*_test.ts"],
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(Array.isArray(result.includes), true);
    assertEquals(result.includes, ["**/*.test.ts", "**/*_test.ts"]);
  });

  it("validates excludes field", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        excludes: ["**/node_modules/**", "**/dist/**"],
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(Array.isArray(result.excludes), true);
    assertEquals(result.excludes, ["**/node_modules/**", "**/dist/**"]);
  });

  it("validates selectors field", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        selectors: ["fast", "integration"],
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(Array.isArray(result.selectors), true);
    assertEquals(result.selectors, ["fast", "integration"]);
  });

  it("validates maxConcurrency field", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        maxConcurrency: 4,
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.maxConcurrency, 4);
  });

  it("validates maxFailures field", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        maxFailures: 10,
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.maxFailures, 10);
  });

  it("returns empty object when probitas section is missing", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      name: "my-project",
      version: "1.0.0",
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    // All fields are undefined
    assertEquals(result.reporter, undefined);
    assertEquals(result.includes, undefined);
    assertEquals(result.excludes, undefined);
  });

  it("handles empty probitas section", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {},
    });
    await Deno.writeTextFile(configPath, configContent);

    const result: ProbitasConfig = await loadConfig(configPath);
    assertEquals(result, {
      reporter: undefined,
      includes: undefined,
      excludes: undefined,
      selectors: undefined,
      maxConcurrency: undefined,
      maxFailures: undefined,
      stepOptions: undefined,
    });
  });

  it("throws error when file does not exist", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "nonexistent.json");
    await assertRejects(
      async () => {
        await loadConfig(configPath);
      },
      Deno.errors.NotFound,
    );
  });

  it("throws error for invalid JSON", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const invalidContent = "{ invalid json content";
    await Deno.writeTextFile(configPath, invalidContent);

    await assertRejects(
      async () => {
        await loadConfig(configPath);
      },
      SyntaxError,
    );
  });

  it("ignores unknown fields", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        reporter: "list",
        unknownField: "should be ignored",
        anotherField: 123,
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.reporter, "list");
    assertEquals((result as Record<string, unknown>).unknownField, undefined);
  });

  it("handles all fields together", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    const configPath = resolve(tempDir, "deno.json");
    const configContent = JSON.stringify({
      probitas: {
        reporter: "json",
        includes: ["**/*.test.ts"],
        excludes: ["**/skip/**"],
        selectors: ["unit", "integration"],
        maxConcurrency: 8,
        maxFailures: 5,
      },
    });
    await Deno.writeTextFile(configPath, configContent);

    const result = await loadConfig(configPath);
    assertEquals(result.reporter, "json");
    assertEquals(result.includes, ["**/*.test.ts"]);
    assertEquals(result.excludes, ["**/skip/**"]);
    assertEquals(result.selectors, ["unit", "integration"]);
    assertEquals(result.maxConcurrency, 8);
    assertEquals(result.maxFailures, 5);
  });
});
