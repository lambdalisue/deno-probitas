# Selector Syntax

Probitas selector syntax allows flexible scenario filtering.

## Basic Syntax

```
[!][type:]value
```

## Selector Types

### tag

Match by tag

```bash
probitas run -s "tag:api"      # Scenarios with @api tag
probitas run -s "!tag:slow"    # Scenarios without @slow tag
```

### name

Match by scenario name (default)

```bash
probitas run -s "Login"        # Scenarios with "Login" in name
probitas run -s "!wip"         # Scenarios without "wip" in name
```

### file

Match by file path

```bash
probitas run -s "file:auth/"   # Scenarios in auth/ directory
probitas run -s "!file:skip"   # Scenarios without "skip" in path
```

## Logical Operators

### OR Condition (multiple -s)

```bash
probitas run -s "tag:smoke" -s "tag:critical"
# @smoke OR @critical
```

### AND Condition (comma-separated)

```bash
probitas run -s "tag:api,tag:critical"
# @api AND @critical
```

### NOT Condition (! prefix)

```bash
probitas run -s "!tag:slow"
# NOT @slow
```

### Combination

```bash
probitas run -s "tag:api,!tag:slow,User"
# @api AND (NOT @slow) AND (name contains "User")
```

## Advanced Examples

### Example 1: Run only critical tests, excluding skipped

```bash
probitas run -s "tag:critical,!tag:skip"
```

### Example 2: Multiple tags with exclusion

```bash
probitas run -s "tag:smoke,!tag:slow" -s "tag:api,!tag:slow"
# (smoke AND NOT slow) OR (api AND NOT slow)
```

### Example 3: All except specific directory

```bash
probitas run -s "!file:experimental/"
```

## Usage in Configuration File

Set default selectors in deno.json:

```jsonc
{
  "probitas": {
    "selectors": [
      "!tag:skip",
      "!wip"
    ]
  }
}
```

CLI options override configuration file settings.

## list Command

Use selectors with `probitas list`:

```bash
# Show scenarios with specific tag
probitas list -s "tag:api"

# Exclude with negation operator
probitas list -s "!tag:slow"

# Multiple conditions
probitas list -s "tag:api,!tag:slow"
```

## Matching

- Case-insensitive matching (e.g., "login" matches "Login")
- Partial match, not exact match

## File Patterns vs Selectors

Probitas has a two-stage filtering mechanism.

### 1. File Patterns (`--include` / `--exclude`)

**Filter applied during file discovery**. Determines which files to load.

```bash
probitas list --include "e2e/**/*.scenario.ts"
probitas run --exclude "**/*.skip.scenario.ts"
```

**Features:**

- Applied at file discovery phase
- Specified with glob patterns
- Default include: `**/*.scenario.ts`
- Default exclude: `**/node_modules/**`, `**/.git/**`

### 2. Selectors (`-s` / `--selector`)

**Filter scenarios after loading**. Filter by tags, names, and file paths.

```bash
probitas run -s "tag:smoke"
probitas run -s "!tag:slow"
```

**Features:**

- Applied after scenario loading
- Uses selector syntax (supports `!` negation)
- Supports AND condition (`,`) and OR condition (multiple `-s`)

### Execution Order

1. **File Discovery**: Determine which files to load with `--include` /
   `--exclude`
2. **Scenario Loading**: Load scenario definitions from discovered files
3. **Selector Application**: Filter scenarios with `-s` / `--selector`

### Implementation Examples

```bash
# Run scenarios with smoke tag in api/ directory
probitas run --include "api/**/*.scenario.ts" -s "tag:smoke"

# Exclude skip files and slow tag scenarios
probitas run --exclude "**/*.skip.ts" -s "!tag:slow"

# Only critical scenarios in e2e tests
probitas run --include "e2e/**/*.ts" -s "tag:critical"
```
