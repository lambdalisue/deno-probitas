/**
 * Tests for cli/console_suppressor.ts
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { ConsoleSuppressor } from "./console_suppressor.ts";

describe("ConsoleSuppressor", () => {
  describe("console suppression", () => {
    it("suppresses console in quiet mode except error", () => {
      const logSpy = stub(console, "log");
      const warnSpy = stub(console, "warn");
      const errorSpy = stub(console, "error");

      try {
        using _suppressor = new ConsoleSuppressor("quiet");

        console.log("test");
        console.warn("warn");
        console.error("error");

        assertEquals(logSpy.calls.length, 0, "log should be suppressed");
        assertEquals(warnSpy.calls.length, 0, "warn should be suppressed");
        assertEquals(
          errorSpy.calls.length,
          1,
          "error should not be suppressed",
        );
      } finally {
        logSpy.restore();
        warnSpy.restore();
        errorSpy.restore();
      }
    });

    it("suppresses console.log in normal mode", () => {
      const logSpy = stub(console, "log");
      const warnSpy = stub(console, "warn");
      const errorSpy = stub(console, "error");

      try {
        using _suppressor = new ConsoleSuppressor("normal");

        console.log("test");
        console.warn("warn");
        console.error("error");

        assertEquals(logSpy.calls.length, 0, "log should be suppressed");
        assertEquals(warnSpy.calls.length, 1, "warn should not be suppressed");
        assertEquals(
          errorSpy.calls.length,
          1,
          "error should not be suppressed",
        );
      } finally {
        logSpy.restore();
        warnSpy.restore();
        errorSpy.restore();
      }
    });

    it("suppresses only debug in verbose mode", () => {
      const logSpy = stub(console, "log");
      const debugSpy = stub(console, "debug");
      const errorSpy = stub(console, "error");

      try {
        using _suppressor = new ConsoleSuppressor("verbose");

        console.log("test");
        console.debug("debug");
        console.error("error");

        assertEquals(logSpy.calls.length, 1, "log should not be suppressed");
        assertEquals(debugSpy.calls.length, 0, "debug should be suppressed");
        assertEquals(
          errorSpy.calls.length,
          1,
          "error should not be suppressed",
        );
      } finally {
        logSpy.restore();
        debugSpy.restore();
        errorSpy.restore();
      }
    });

    it("does not suppress anything in debug mode", () => {
      const logSpy = stub(console, "log");
      const debugSpy = stub(console, "debug");
      const errorSpy = stub(console, "error");

      try {
        using _suppressor = new ConsoleSuppressor("debug");

        console.log("test");
        console.debug("debug");
        console.error("error");

        assertEquals(logSpy.calls.length, 1, "log should not be suppressed");
        assertEquals(
          debugSpy.calls.length,
          1,
          "debug should not be suppressed",
        );
        assertEquals(
          errorSpy.calls.length,
          1,
          "error should not be suppressed",
        );
      } finally {
        logSpy.restore();
        debugSpy.restore();
        errorSpy.restore();
      }
    });

    it("suppresses info in quiet mode", () => {
      const infoSpy = stub(console, "info");
      const errorSpy = stub(console, "error");

      try {
        using _suppressor = new ConsoleSuppressor("quiet");

        console.info("info");
        console.error("error");

        assertEquals(infoSpy.calls.length, 0, "info should be suppressed");
        assertEquals(
          errorSpy.calls.length,
          1,
          "error should not be suppressed",
        );
      } finally {
        infoSpy.restore();
        errorSpy.restore();
      }
    });
  });

  describe("console restoration", () => {
    it("restores console after dispose", () => {
      const logSpy = stub(console, "log");

      try {
        {
          using _suppressor = new ConsoleSuppressor("quiet");
          console.log("test");
          assertEquals(logSpy.calls.length, 0);
        }

        // After disposal
        console.log("restored");
        assertEquals(logSpy.calls.length, 1);
      } finally {
        logSpy.restore();
      }
    });

    it("restores console for quiet level", () => {
      const warnSpy = stub(console, "warn");

      try {
        {
          using _suppressor = new ConsoleSuppressor("quiet");
          console.warn("test");
          assertEquals(warnSpy.calls.length, 0);
        }

        // After disposal
        console.warn("restored");
        assertEquals(warnSpy.calls.length, 1);
      } finally {
        warnSpy.restore();
      }
    });

    it("restores console for normal level", () => {
      const logSpy = stub(console, "log");

      try {
        {
          using _suppressor = new ConsoleSuppressor("normal");
          console.log("test");
          assertEquals(logSpy.calls.length, 0);
        }

        // After disposal
        console.log("restored");
        assertEquals(logSpy.calls.length, 1);
      } finally {
        logSpy.restore();
      }
    });

    it("restores console for verbose level", () => {
      const debugSpy = stub(console, "debug");

      try {
        {
          using _suppressor = new ConsoleSuppressor("verbose");
          console.debug("test");
          assertEquals(debugSpy.calls.length, 0);
        }

        // After disposal
        console.debug("restored");
        assertEquals(debugSpy.calls.length, 1);
      } finally {
        debugSpy.restore();
      }
    });
  });

  describe("disposable pattern", () => {
    it("automatically restores on disposal", () => {
      const logSpy = stub(console, "log");

      try {
        using suppressor = new ConsoleSuppressor("quiet");
        // Verify it's a Disposable
        assertEquals(typeof suppressor[Symbol.dispose], "function");
      } finally {
        logSpy.restore();
      }
    });
  });
});
