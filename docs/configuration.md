# Configuration

Probitas is configured via `deno.json` or `deno.jsonc`. Configuration is stored
in the `probitas` section of the configuration file.

## Configuration Location

Probitas searches for configuration files in the following order:

1. Explicitly specified via `--config` option
2. Specified via `PROBITAS_CONFIG` environment variable
3. Automatically search for `deno.json` or `deno.jsonc` in the current directory
   and parent directories

## Basic Configuration

Create or update your `deno.json` (or `deno.jsonc`) with a `probitas` section:

```jsonc
{
  "probitas": {
    // Reporter format
    "reporter": "list",
    // File discovery patterns (glob)
    "includes": [
      "**/*.scenario.ts"
    ],
    // Exclude patterns (glob)
    "excludes": [
      "**/node_modules/**",
      "**/.git/**"
    ]
  }
}
```

## Configuration Fields

### reporter

Default reporter format for test output.

**Options**: `dot`, `list`, `json`, `tap`

**Default**: `list`

**Example**:

```jsonc
{
  "probitas": {
    "reporter": "json"
  }
}
```

### includes

File discovery patterns (glob) for scenario files.

**Type**: Array of strings

**Default**: `["**/*.scenario.ts"]`

**Example**:

```jsonc
{
  "probitas": {
    "includes": [
      "**/*.scenario.ts",
      "**/*.feature.ts"
    ]
  }
}
```

### excludes

Exclude patterns (glob) to skip certain files or directories.

**Type**: Array of strings

**Default**: `["**/node_modules/**", "**/.git/**"]`

**Example**:

```jsonc
{
  "probitas": {
    "excludes": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**"
    ]
  }
}
```

### selectors (optional)

Default selectors to filter scenarios by tags.

**Type**: Array of strings

**Example**:

```jsonc
{
  "probitas": {
    "selectors": ["@smoke", "@integration"]
  }
}
```

### maxConcurrency (optional)

Maximum number of scenarios to run concurrently.

**Type**: Number

**Example**:

```jsonc
{
  "probitas": {
    "maxConcurrency": 4
  }
}
```

### maxFailures (optional)

Stop execution after this many failures.

**Type**: Number

**Example**:

```jsonc
{
  "probitas": {
    "maxFailures": 5
  }
}
```

### stepOptions (optional)

Default step options applied to all steps in all scenarios. These settings can
be overridden at the scenario or step level.

**Type**: Object with optional timeout and retry configuration

**Example**:

```jsonc
{
  "probitas": {
    "stepOptions": {
      "timeout": 30000,
      "retry": {
        "maxAttempts": 3,
        "backoff": "exponential"
      }
    }
  }
}
```

## Step Options

The `stepOptions` configuration allows you to set default values for step
execution behavior. This is useful for setting organization-wide defaults that
apply to all scenarios.

### Supported Fields

- **timeout**: Maximum time (in milliseconds) for a step to complete (default:
  Infinity)
- **retry.maxAttempts**: Number of attempts before considering a step failed
  (default: 1)
- **retry.backoff**: Backoff strategy for retries - `linear` or `exponential`
  (default: `linear`)

### Priority

Step options are merged according to this priority:

```
step-level options > scenario-level options > config-level (run) options
```

Example:

```jsonc
{
  "probitas": {
    "stepOptions": {
      "timeout": 5000,
      "retry": {
        "maxAttempts": 2,
        "backoff": "linear"
      }
    }
  }
}
```

In your scenario code, you can override these defaults:

```typescript
const scenario = defineScenario({
  stepOptions: {
    timeout: 10000, // Override timeout
  },
  steps: [
    step("do something", async () => {
      // Uses timeout: 10000 from scenario, maxAttempts: 2 from config
    }),
  ],
});
```

## Priority

Configuration values are resolved in the following priority order:

```
CLI options > Environment variables > Config file > Defaults
```

Example:

```bash
# CLI option takes highest priority
probitas run --reporter json

# Environment variable takes second priority
PROBITAS_CONFIG=./config.jsonc probitas run

# Config file takes third priority
# deno.jsonc contains: "reporter": "list"

# Defaults are used if nothing else is specified
```

## Environment Variables

### PROBITAS_CONFIG

Explicitly specify the path to the configuration file.

**Example**:

```bash
PROBITAS_CONFIG=./scenarios/deno.jsonc probitas run
```

### NO_COLOR

Disable colored output in the console. Set this variable to any non-empty value.

**Example**:

```bash
NO_COLOR=1 probitas run
```

## Complete Example

Here's a complete configuration example with multiple features:

```jsonc
{
  "imports": {
    "probitas": "jsr:@lambdalisue/probitas@^1.0.0"
  },
  "probitas": {
    "reporter": "list",
    "includes": [
      "scenarios/**/*.scenario.ts",
      "tests/**/*.feature.ts"
    ],
    "excludes": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**"
    ],
    "selectors": ["@smoke"],
    "maxConcurrency": 4,
    "maxFailures": 10,
    "stepOptions": {
      "timeout": 30000,
      "retry": {
        "maxAttempts": 3,
        "backoff": "exponential"
      }
    }
  }
}
```

## Initialization

To initialize a new Probitas project with default configuration, use the `init`
command:

```bash
probitas init
```

This will create or update `deno.jsonc` with the default Probitas configuration.
