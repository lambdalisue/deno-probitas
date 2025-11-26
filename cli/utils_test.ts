/**
 * Tests for utility functions
 *
 * @module
 */

import {
  assertEquals,
  assertInstanceOf,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { ScenarioDefinition } from "../src/runner/types.ts";
import {
  applySelectors,
  getVersion,
  parseMaxConcurrency,
  parseMaxFailures,
  readAsset,
  readTemplate,
  resolveReporter,
} from "./utils.ts";
import { parseSelector } from "./types.ts";
import {
  DotReporter,
  JSONReporter,
  ListReporter,
  TAPReporter,
} from "../src/reporter/mod.ts";

describe("utils", () => {
  describe("resolveReporter", () => {
    it("resolves 'list' to ListReporter", () => {
      const reporter = resolveReporter("list");
      assertEquals(reporter instanceof ListReporter, true);
    });

    it("resolves 'dot' to DotReporter", () => {
      const reporter = resolveReporter("dot");
      assertEquals(reporter instanceof DotReporter, true);
    });

    it("resolves 'json' to JSONReporter", () => {
      const reporter = resolveReporter("json");
      assertEquals(reporter instanceof JSONReporter, true);
    });

    it("resolves 'tap' to TAPReporter", () => {
      const reporter = resolveReporter("tap");
      assertEquals(reporter instanceof TAPReporter, true);
    });

    it("returns ListReporter when undefined is passed", () => {
      const reporter = resolveReporter(undefined);
      assertEquals(reporter instanceof ListReporter, true);
    });

    it("throws error for unknown reporter name", () => {
      assertThrows(
        () => {
          resolveReporter("unknown");
        },
        Error,
        "Unknown reporter: unknown",
      );
    });

    it("returns Reporter instance as-is", () => {
      const customReporter = new ListReporter();
      const reporter = resolveReporter(customReporter);
      assertEquals(reporter, customReporter);
    });

    it("returns ListReporter when empty string is passed", () => {
      const reporter = resolveReporter("");
      assertEquals(reporter instanceof ListReporter, true);
    });

    it("passes options to ListReporter", () => {
      const reporter = resolveReporter("list", {
        noColor: true,
      });
      assertInstanceOf(reporter, ListReporter);
    });

    it("passes options when reporter is undefined", () => {
      const reporter = resolveReporter(undefined, { noColor: true });
      assertInstanceOf(reporter, ListReporter);
    });

    it("passes options to DotReporter", () => {
      const reporter = resolveReporter("dot", {
        noColor: false,
      });
      assertInstanceOf(reporter, DotReporter);
    });

    it("passes options to JSONReporter", () => {
      const reporter = resolveReporter("json", {});
      assertInstanceOf(reporter, JSONReporter);
    });

    it("does not override Reporter instance with options", () => {
      const customReporter = new ListReporter();
      const reporter = resolveReporter(customReporter, { noColor: true });
      assertEquals(reporter, customReporter);
    });
  });

  describe("parseMaxConcurrency", () => {
    it("parses string number", () => {
      const concurrency = parseMaxConcurrency("4");
      assertEquals(concurrency, 4);
    });

    it("parses numeric value", () => {
      const concurrency = parseMaxConcurrency(8);
      assertEquals(concurrency, 8);
    });

    it("returns undefined when undefined is passed", () => {
      const concurrency = parseMaxConcurrency(undefined);
      assertEquals(concurrency, undefined);
    });

    it("throws error for invalid number string", () => {
      assertThrows(
        () => {
          parseMaxConcurrency("abc");
        },
        Error,
        "max-concurrency must be a positive integer",
      );
    });

    it("throws error for zero", () => {
      assertThrows(
        () => {
          parseMaxConcurrency("0");
        },
        Error,
        "max-concurrency must be a positive integer",
      );
    });

    it("throws error for negative number", () => {
      assertThrows(
        () => {
          parseMaxConcurrency("-5");
        },
        Error,
        "max-concurrency must be a positive integer",
      );
    });

    it("throws error for decimal number", () => {
      assertThrows(
        () => {
          parseMaxConcurrency("2.5");
        },
        Error,
        "max-concurrency must be a positive integer",
      );
    });

    it("accepts large numbers", () => {
      const concurrency = parseMaxConcurrency("1000");
      assertEquals(concurrency, 1000);
    });
  });

  describe("parseMaxFailures", () => {
    it("parses string number", () => {
      const failures = parseMaxFailures("5");
      assertEquals(failures, 5);
    });

    it("parses numeric value", () => {
      const failures = parseMaxFailures(3);
      assertEquals(failures, 3);
    });

    it("returns undefined when undefined is passed", () => {
      const failures = parseMaxFailures(undefined);
      assertEquals(failures, undefined);
    });

    it("throws error for invalid number string", () => {
      assertThrows(
        () => {
          parseMaxFailures("xyz");
        },
        Error,
        "max-failures must be a positive integer",
      );
    });

    it("throws error for zero", () => {
      assertThrows(
        () => {
          parseMaxFailures("0");
        },
        Error,
        "max-failures must be a positive integer",
      );
    });

    it("throws error for negative number", () => {
      assertThrows(
        () => {
          parseMaxFailures("-3");
        },
        Error,
        "max-failures must be a positive integer",
      );
    });

    it("throws error for decimal number", () => {
      assertThrows(
        () => {
          parseMaxFailures("1.5");
        },
        Error,
        "max-failures must be a positive integer",
      );
    });

    it("accepts large numbers", () => {
      const failures = parseMaxFailures("500");
      assertEquals(failures, 500);
    });
  });

  describe("readTemplate", () => {
    it("reads probitas.config.ts template", async () => {
      const content = await readTemplate("probitas.config.ts");
      assertStringIncludes(content, "ProbitasConfig");
      assertStringIncludes(content, "satisfies");
    });

    it("reads deno.jsonc template", async () => {
      const content = await readTemplate("deno.jsonc");
      assertStringIncludes(content, "imports");
      assertStringIncludes(content, "{{VERSION}}");
    });

    it("reads example.scenario.ts template", async () => {
      const content = await readTemplate("example.scenario.ts");
      assertStringIncludes(content, "Example Scenario");
      assertStringIncludes(content, "import { scenario }");
    });
  });

  describe("readAsset", () => {
    it("reads usage.txt", async () => {
      const content = await readAsset("usage.txt");
      assertStringIncludes(content, "Probitas");
      assertStringIncludes(content, "Usage:");
    });

    it("reads usage-run.txt", async () => {
      const content = await readAsset("usage-run.txt");
      assertStringIncludes(content, "probitas run");
    });

    it("reads usage-list.txt", async () => {
      const content = await readAsset("usage-list.txt");
      assertStringIncludes(content, "probitas list");
    });

    it("reads usage-init.txt", async () => {
      const content = await readAsset("usage-init.txt");
      assertStringIncludes(content, "probitas init");
    });
  });

  describe("getVersion", () => {
    it("reads version from deno.jsonc", () => {
      const version = getVersion();
      assertEquals(typeof version, "string");
      // Should be a version or "unknown"
    });
  });

  // Test helper to create scenario
  const createScenario = (
    name: string,
    tags: string[] = [],
    filePath: string = "example.scenario.ts",
  ): ScenarioDefinition => ({
    name,
    location: { file: filePath, line: 1 },
    options: {
      tags,
      skip: null,
      setup: null,
      teardown: null,
      stepOptions: {
        timeout: 5000,
        retry: { maxAttempts: 1, backoff: "linear" },
      },
    },
    steps: [],
  });

  describe("parseSelector", () => {
    it("parses tag selector without negation", () => {
      const selector = parseSelector("tag:api");
      assertEquals(selector.type, "tag");
      assertEquals(selector.value, "api");
      assertEquals(selector.negated, false);
    });

    it("parses name selector without negation", () => {
      const selector = parseSelector("name:login");
      assertEquals(selector.type, "name");
      assertEquals(selector.value, "login");
      assertEquals(selector.negated, false);
    });

    it("parses file selector without negation", () => {
      const selector = parseSelector("file:auth/");
      assertEquals(selector.type, "file");
      assertEquals(selector.value, "auth/");
      assertEquals(selector.negated, false);
    });

    it("parses selector with ! negation", () => {
      const selector = parseSelector("!tag:slow");
      assertEquals(selector.type, "tag");
      assertEquals(selector.value, "slow");
      assertEquals(selector.negated, true);
    });

    it("handles whitespace around !", () => {
      const selector = parseSelector("! tag:slow");
      assertEquals(selector.type, "tag");
      assertEquals(selector.value, "slow");
      assertEquals(selector.negated, true);
    });

    it("defaults to name type when no type specified", () => {
      const selector = parseSelector("wip");
      assertEquals(selector.type, "name");
      assertEquals(selector.value, "wip");
      assertEquals(selector.negated, false);
    });

    it("handles ! prefix with default type", () => {
      const selector = parseSelector("!wip");
      assertEquals(selector.type, "name");
      assertEquals(selector.value, "wip");
      assertEquals(selector.negated, true);
    });
  });

  describe("applySelectors with negation", () => {
    const scenarios = [
      createScenario("Login Test", ["api", "auth"], "auth.scenario.ts"),
      createScenario("Logout Test", ["api"], "auth.scenario.ts"),
      createScenario("User API Test", ["api", "user"], "user.scenario.ts"),
      createScenario("Smoke Test", ["smoke"], "smoke.scenario.ts"),
      createScenario("Slow Test", ["api", "slow"], "perf.scenario.ts"),
    ];

    describe("simple negation", () => {
      it("filters out scenarios with negated tag", () => {
        const result = applySelectors(scenarios, ["!tag:slow"]);
        assertEquals(result.length, 4);
        assertEquals(
          result.map((s) => s.name).sort(),
          ["Login Test", "Logout Test", "Smoke Test", "User API Test"],
        );
      });

      it("filters out scenarios with negated name", () => {
        const result = applySelectors(scenarios, ["!wip"]);
        assertEquals(result.length, 5);
      });

      it("filters out scenarios with negated file", () => {
        const result = applySelectors(scenarios, ["!file:perf"]);
        assertEquals(result.length, 4);
        assertEquals(
          result.map((s) => s.name).sort(),
          ["Login Test", "Logout Test", "Smoke Test", "User API Test"],
        );
      });
    });

    describe("combined conditions", () => {
      it("applies AND condition with negation: tag:api,!tag:slow", () => {
        const result = applySelectors(scenarios, ["tag:api,!tag:slow"]);
        assertEquals(result.length, 3);
        assertEquals(
          result.map((s) => s.name).sort(),
          ["Login Test", "Logout Test", "User API Test"],
        );
      });

      it("applies OR condition with negation: !tag:skip -s !tag:wip", () => {
        const result = applySelectors(scenarios, ["!tag:skip", "!tag:wip"]);
        assertEquals(result.length, 5);
      });

      it("applies complex condition: tag:api,!tag:slow,User", () => {
        const result = applySelectors(scenarios, ["tag:api,!tag:slow,User"]);
        assertEquals(result.length, 1);
        assertEquals(result[0].name, "User API Test");
      });
    });

    describe("edge cases", () => {
      it("handles double negation (!!tag:smoke) as positive", () => {
        const result = applySelectors(scenarios, ["!!tag:smoke"]);
        assertEquals(result.length, 1);
        assertEquals(result[0].name, "Smoke Test");
      });

      it("handles empty selector list", () => {
        const result = applySelectors(scenarios, []);
        assertEquals(result.length, 5);
      });

      it("returns all scenarios for selector that matches all with negation check", () => {
        const result = applySelectors(scenarios, ["!nonexistent"]);
        assertEquals(result.length, 5);
      });
    });

    it("applies single tag selector (OR)", () => {
      const result = applySelectors(scenarios, ["tag:smoke"]);
      assertEquals(result.length, 1);
      assertEquals(result[0].name, "Smoke Test");
    });

    it("applies multiple tag selectors (OR)", () => {
      const result = applySelectors(scenarios, ["tag:auth", "tag:smoke"]);
      assertEquals(result.length, 2);
      assertEquals(result.map((s) => s.name).sort(), [
        "Login Test",
        "Smoke Test",
      ]);
    });

    it("applies combined selectors (AND within selector)", () => {
      const result = applySelectors(scenarios, ["tag:api,tag:auth"]);
      assertEquals(result.length, 1);
      assertEquals(result[0].name, "Login Test");
    });

    it("applies name selector", () => {
      const result = applySelectors(scenarios, ["User"]);
      assertEquals(result.length, 1);
      assertEquals(result[0].name, "User API Test");
    });

    it("returns all scenarios when no selectors", () => {
      const result = applySelectors(scenarios, []);
      assertEquals(result.length, 5);
    });
  });
});
