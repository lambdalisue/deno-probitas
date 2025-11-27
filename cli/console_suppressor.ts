/**
 * Console suppressor for CLI layer
 *
 * Suppresses console output based on verbosity level and automatically
 * restores it when disposed.
 *
 * @module
 */

/**
 * Verbosity levels for console output
 */
export type Verbosity = "quiet" | "normal" | "verbose" | "debug";

/**
 * Console suppressor that temporarily replaces console methods
 *
 * Implements Disposable for automatic restoration with 'using' syntax.
 *
 * @example
 * ```typescript
 * using _suppressor = new ConsoleSuppressor("quiet");
 * console.log("This will not be printed");
 * // After exiting scope, console.log is restored
 * ```
 */
export class ConsoleSuppressor implements Disposable {
  #originalConsole = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    info: console.info,
    debug: console.debug,
  };

  /**
   * Create a new console suppressor
   *
   * Automatically suppresses console output based on verbosity level.
   *
   * Verbosity levels:
   * - `quiet`: error only (suppress warn, log, info, debug)
   * - `normal`: error, warn (suppress log, info, debug)
   * - `verbose`: error, warn, log, info (suppress debug)
   * - `debug`: all output (no suppression)
   *
   * @param verbosity - Verbosity level (default: "normal")
   */
  constructor(verbosity: Verbosity = "normal") {
    switch (verbosity) {
      case "quiet":
        // Suppress log, info, debug (keep error, warn)
        console.info =
          console.log =
          console.debug =
            () => {};
        break;
      case "normal":
        // Suppress log, info, debug (keep error, warn, info)
        console.log = console.debug = () => {};
        break;
      case "verbose":
        // Suppress debug only (keep error, warn, info, log)
        console.debug = () => {};
        break;
      case "debug":
        // Do not suppress anything
        break;
    }
  }

  /**
   * Dispose method for automatic restoration with 'using' syntax
   *
   * Restores console to original functions when the instance goes out of scope.
   */
  [Symbol.dispose](): void {
    Object.assign(console, this.#originalConsole);
  }
}
