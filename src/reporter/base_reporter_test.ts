/**
 * Tests for BaseReporter abstract class
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertStringIncludes,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "@std/streams/buffer";
import { BaseReporter } from "./base_reporter.ts";
import type {
  RunSummary,
  ScenarioDefinition,
  ScenarioResult,
  StepDefinition,
  StepResult,
} from "./types.ts";

/**
 * Concrete implementation of BaseReporter for testing
 */
class TestReporter extends BaseReporter {
  outputs: string[] = [];

  override async write(text: string): Promise<void> {
    this.outputs.push(text);
    await super.write(text);
  }

  // Test helper method to apply theme formatting
  formatSuccess(text: string): string {
    return this.theme.success(text);
  }

  formatFailure(text: string): string {
    return this.theme.failure(text);
  }

  onScenarioStart(_scenario: ScenarioDefinition): void {
    // no-op
  }

  onScenarioSkip(_scenario: ScenarioDefinition, _reason: string): void {
    // no-op
  }

  onStepStart(_step: StepDefinition): void {
    // no-op
  }

  onStepEnd(_step: StepDefinition, _result: StepResult): void {
    // no-op
  }

  onStepError(_step: StepDefinition, _error: Error): void {
    // no-op
  }

  onScenarioEnd(_scenario: ScenarioDefinition, _result: ScenarioResult): void {
    // no-op
  }

  override onRunStart(_scenarios: readonly ScenarioDefinition[]): void {
    // no-op
  }

  override async onRunEnd(_summary: RunSummary): Promise<void> {
    // no-op
  }
}

describe("BaseReporter", () => {
  describe("initialization", () => {
    it("initializes with default output (Deno.stderr)", () => {
      const reporter = new TestReporter();
      assertExists(reporter);
    });

    it("respects custom output stream", async () => {
      const buffer = new Buffer();
      const reporter = new TestReporter({ output: buffer.writable });

      // Write some text to the custom output stream
      const testText = "custom stream output";
      await reporter.write(testText);

      // Verify the text was written to the custom buffer
      const output = new TextDecoder().decode(buffer.bytes());
      assertStringIncludes(output, testText);
    });

    it("respects noColor option", () => {
      const reporterWithColor = new TestReporter({ noColor: false });
      const reporterNoColor = new TestReporter({ noColor: true });

      const testText = "test";

      // With noColor:false, theme should add ANSI codes
      const coloredSuccess = reporterWithColor.formatSuccess(testText);
      assertNotEquals(
        coloredSuccess,
        testText,
        "noColor:false should add ANSI escape codes for colors",
      );

      // With noColor:true, theme should not modify text
      const plainSuccess = reporterNoColor.formatSuccess(testText);
      assertEquals(
        plainSuccess,
        testText,
        "noColor:true should output plain text without ANSI codes",
      );
    });
  });

  describe("output stream", () => {
    it("writes to output stream", async () => {
      const buffer = new Buffer();
      const reporter = new TestReporter({ output: buffer.writable });

      const testText = "test output";
      await reporter.write(testText);

      const output = new TextDecoder().decode(buffer.bytes());
      assertStringIncludes(output, testText);
    });

    it("handles multiple writes", async () => {
      const buffer = new Buffer();
      const reporter = new TestReporter({ output: buffer.writable });

      await reporter.write("first");
      await reporter.write("second");
      await reporter.write("third");

      const output = new TextDecoder().decode(buffer.bytes());
      assertStringIncludes(output, "first");
      assertStringIncludes(output, "second");
      assertStringIncludes(output, "third");
    });
  });
});
