/**
 * Tests for subprocess runner
 *
 * @requires --allow-read Permission to read scenario files
 * @requires --allow-write Permission to write temporary test files
 * @requires --allow-run Permission to run subprocess
 * @module
 */

import outdent from "outdent";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { defer } from "../src/helper/defer.ts";

describe("runner_subprocess", () => {
  it("executes scenarios and returns exit code 0 on success", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    // Create a passing scenario file
    const scenarioPath = resolve(tempDir, "test.scenario.ts");
    const content = outdent`
      export default {
        name: "Passing Test",
        options: {
          tags: [],
          skip: null,
          setup: null,
          teardown: null,
          stepOptions: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
        },
        steps: [
          {
            name: "Step 1",
            fn: () => ({ result: "success" }),
            options: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
          }
        ]
      };
    `;
    await Deno.writeTextFile(scenarioPath, content);

    // Create subprocess input
    const input = {
      files: [scenarioPath],
      selectors: [],
      reporter: "json",
      noColor: true,
    };

    // Run subprocess
    const subprocessPath = new URL(
      "./runner_subprocess.ts",
      import.meta.url,
    ).pathname;

    const cmd = new Deno.Command("deno", {
      args: ["run", "-A", subprocessPath],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const child = cmd.spawn();

    // Send input via stdin
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify(input)));
    await writer.close();

    // Read output and wait for completion
    const [result, stdout, stderr] = await Promise.all([
      child.status,
      child.stdout.arrayBuffer().then((buf) => new TextDecoder().decode(buf)),
      child.stderr.arrayBuffer().then((buf) => new TextDecoder().decode(buf)),
    ]);

    if (result.code !== 0) {
      console.error("Subprocess failed:");
      console.error("stdout:", stdout);
      console.error("stderr:", stderr);
    }

    assertEquals(result.code, 0);
  });

  it("returns exit code 1 when scenarios fail", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    // Create a failing scenario file
    const scenarioPath = resolve(tempDir, "test.scenario.ts");
    const content = outdent`
      export default {
        name: "Failing Test",
        options: {
          tags: [],
          skip: null,
          setup: null,
          teardown: null,
          stepOptions: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
        },
        steps: [
          {
            name: "Step 1",
            fn: () => { throw new Error("Test failed"); },
            options: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
          }
        ]
      };
    `;
    await Deno.writeTextFile(scenarioPath, content);

    // Create subprocess input
    const input = {
      files: [scenarioPath],
      selectors: [],
      reporter: "json",
      noColor: true,
    };

    // Run subprocess
    const subprocessPath = new URL(
      "./runner_subprocess.ts",
      import.meta.url,
    ).pathname;

    const cmd = new Deno.Command("deno", {
      args: ["run", "-A", subprocessPath],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const child = cmd.spawn();

    // Send input via stdin
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify(input)));
    await writer.close();

    // Read output and wait for completion
    const [result] = await Promise.all([
      child.status,
      child.stdout.arrayBuffer(),
      child.stderr.arrayBuffer(),
    ]);

    assertEquals(result.code, 1);
  });

  it("returns exit code 4 when no scenarios found", async () => {
    // Create subprocess input with non-existent file
    const input = {
      files: ["/nonexistent/file.scenario.ts"],
      selectors: [],
      reporter: "json",
      noColor: true,
    };

    // Run subprocess
    const subprocessPath = new URL(
      "./runner_subprocess.ts",
      import.meta.url,
    ).pathname;

    const cmd = new Deno.Command("deno", {
      args: ["run", "-A", subprocessPath],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const child = cmd.spawn();

    // Send input via stdin
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify(input)));
    await writer.close();

    // Read output and wait for completion
    const [result] = await Promise.all([
      child.status,
      child.stdout.arrayBuffer(),
      child.stderr.arrayBuffer(),
    ]);

    assertEquals(result.code, 1);
  });

  it("applies selectors correctly", async () => {
    const tempDir = await Deno.makeTempDir();
    await using _cleanup = defer(async () => {
      await Deno.remove(tempDir, { recursive: true });
    });

    // Create scenario with tags
    const scenarioPath = resolve(tempDir, "test.scenario.ts");
    const content = outdent`
      export default [
        {
          name: "API Test",
          options: {
            tags: ["api", "critical"],
            skip: null,
            setup: null,
            teardown: null,
            stepOptions: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
          },
          steps: [
            {
              name: "Step 1",
              fn: () => ({ result: "success" }),
              options: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
            }
          ]
        },
        {
          name: "DB Test",
          options: {
            tags: ["db", "slow"],
            skip: null,
            setup: null,
            teardown: null,
            stepOptions: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
          },
          steps: [
            {
              name: "Step 1",
              fn: () => ({ result: "success" }),
              options: { timeout: 5000, retry: { maxAttempts: 1, backoff: "linear" } }
            }
          ]
        }
      ];
    `;
    await Deno.writeTextFile(scenarioPath, content);

    // Create subprocess input with selector
    const input = {
      files: [scenarioPath],
      selectors: ["tag:api"],
      reporter: "json",
      noColor: true,
    };

    // Run subprocess
    const subprocessPath = new URL(
      "./runner_subprocess.ts",
      import.meta.url,
    ).pathname;

    const cmd = new Deno.Command("deno", {
      args: ["run", "-A", subprocessPath],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const child = cmd.spawn();

    // Send input via stdin
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify(input)));
    await writer.close();

    // Read output and wait for completion
    const [result, stdout, stderr] = await Promise.all([
      child.status,
      child.stdout.arrayBuffer().then((buf) => new TextDecoder().decode(buf)),
      child.stderr.arrayBuffer().then((buf) => new TextDecoder().decode(buf)),
    ]);

    if (result.code !== 0) {
      console.error("Subprocess failed:");
      console.error("stdout:", stdout);
      console.error("stderr:", stderr);
    }

    // Should succeed
    assertEquals(result.code, 0);
  });
});
