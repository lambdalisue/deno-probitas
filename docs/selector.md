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
