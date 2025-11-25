/**
 * BaseReporter abstract class
 *
 * Provides common functionality for all Reporter implementations:
 * - Output stream management
 * - NO_COLOR environment variable support
 * - Color function selection
 *
 * @module
 */

import { defaultTheme, noColorTheme } from "./theme.ts";
import type {
  Reporter,
  ReporterOptions,
  RunSummary,
  ScenarioDefinition,
  ScenarioResult,
  StepDefinition,
  StepResult,
  Theme,
} from "./types.ts";

/**
 * Abstract base class for all reporters
 *
 * Provides common functionality for output management.
 * Subclasses must implement the abstract methods.
 */
export abstract class BaseReporter implements Reporter {
  protected output: WritableStream;
  protected theme: Theme;
  protected options: ReporterOptions;

  #writeQueue: Promise<void> = Promise.resolve();

  /**
   * Initialize the reporter
   *
   * @param options Configuration options
   */
  constructor(options: ReporterOptions = {}) {
    this.output = options.output ?? Deno.stderr.writable;

    const noColor = options.noColor ?? false;

    this.options = {
      output: this.output,
      noColor: noColor,
    };

    this.theme = options.theme ?? (noColor ? noColorTheme : defaultTheme);
  }

  /**
   * Write text to output stream
   *
   * Serializes all write operations to prevent "stream is already locked" errors
   * when multiple scenarios write concurrently.
   *
   * @param text Text to write
   */
  protected async write(text: string): Promise<void> {
    this.#writeQueue = this.#writeQueue.then(async () => {
      const writer = this.output.getWriter();
      try {
        await writer.write(new TextEncoder().encode(text));
      } finally {
        writer.releaseLock();
      }
    });
    await this.#writeQueue;
  }

  /**
   * Sanitize file paths in error stack traces to make them environment-independent
   *
   * Replaces absolute file:// URLs with relative paths to ensure snapshots
   * are portable across different machines and CI environments.
   *
   * @param stack The error stack trace string
   * @returns Sanitized stack trace with normalized paths
   */
  protected sanitizeStack(stack: string): string {
    // Replace file:// URLs with relative paths
    // Matches patterns like: file:///Users/name/project/src/file.ts:123:45
    // Replaces with: src/file.ts:123:45 (preserving only relative path from project root)
    return stack.replace(
      /file:\/\/\/[^\s]*\/(src\/[^\s:)]+)/g,
      "$1",
    );
  }

  /**
   * Called when scenario starts (to be implemented by subclass)
   */
  abstract onScenarioStart(scenario: ScenarioDefinition): void | Promise<void>;

  /**
   * Called when scenario is skipped (to be implemented by subclass)
   */
  abstract onScenarioSkip(
    scenario: ScenarioDefinition,
    reason: string,
  ): void | Promise<void>;

  /**
   * Called when step starts (to be implemented by subclass)
   */
  abstract onStepStart(step: StepDefinition): void | Promise<void>;

  /**
   * Called when step completes successfully (to be implemented by subclass)
   */
  abstract onStepEnd(
    step: StepDefinition,
    result: StepResult,
  ): void | Promise<void>;

  /**
   * Called when step fails (to be implemented by subclass)
   */
  abstract onStepError(
    step: StepDefinition,
    error: Error,
  ): void | Promise<void>;

  /**
   * Called when scenario completes (to be implemented by subclass)
   */
  abstract onScenarioEnd(
    scenario: ScenarioDefinition,
    result: ScenarioResult,
  ): void | Promise<void>;

  /**
   * Called when test run starts (to be implemented by subclass)
   */
  abstract onRunStart(
    scenarios: readonly ScenarioDefinition[],
  ): void | Promise<void>;

  /**
   * Called when test run completes (to be implemented by subclass)
   */
  abstract onRunEnd(summary: RunSummary): Promise<void>;
}
