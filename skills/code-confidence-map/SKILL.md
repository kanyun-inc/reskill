---
name: code-confidence-map
description: Assesses code comprehensibility and maintainability risk. Use when the user asks about code confidence, risk, maintainability, tech debt, code health, or whether code is safe to change. Also use when the user asks to analyze code quality, scan for risks, check if code is messy or complex, audit code, do a code checkup, find weak spots, assess what needs refactoring, or asks about code trust, hidden risks, gotchas, or onboarding to a codebase.
version: 0.1.0
author: reskill
tags:
  - code-quality
  - maintainability
  - risk-assessment
  - tech-debt
---

# Code Confidence Map

Helps AI agents answer a core question: **"If this code breaks tomorrow, how well-equipped are we to understand and fix it?"**

This is NOT a linter or code quality tool. It measures *comprehensibility risk* — the gap between code complexity and human understanding. The AI's unique advantage over static analysis tools is **semantic judgment**: it can tell that `processData` does 5 unrelated things, that tests only cover happy paths, or that `// don't touch this` is a red flag.

## When to Use This Skill

Use this skill when the user:

- Asks about code confidence, risk, or maintainability
- Says "is this code safe to change?" or "how risky is this module?"
- Is onboarding to a new codebase and wants to understand the landscape
- Wants to know where the tech debt or weak spots are
- Asks "which parts of the codebase are well-tested?"
- Says "scan this directory" or "check this file's health"
- Is planning a refactor and wants to assess risk first
- Asks about code quality, code health, or how solid a module is

## Core Concept: What "Confidence" Means

**Confidence** is the answer to: *"If something goes wrong here, can we understand and fix it?"*

It is NOT:
- A judgment on code quality (LOW confidence is a risk signal, not a verdict)
- A measure of cleverness or elegance
- An indicator of who wrote the code or when

**Confidence levels:**

| Level      | Meaning                                                           |
| ---------- | ----------------------------------------------------------------- |
| **HIGH**   | Well-tested, readable, good error handling — safe to work with    |
| **MEDIUM** | Partially covered — some gaps in tests, docs, or error handling   |
| **LOW**    | Significant gaps — risky to modify without additional preparation |

Do NOT use percentages (e.g., "73.2%"). They imply false precision for what is fundamentally a judgment call.

**Overall level rule:** The overall confidence level equals the **lowest** dimension level. If any single dimension is LOW, the overall is LOW — one critical gap is enough to make code risky to work with.

## What We Explicitly Do NOT Measure

- **Time since last edit** — Stable code is fine. Code that hasn't been touched in years may be the most reliable in the project.
- **Lines of code** as a standalone metric — More code does not mean worse code.
- **Number of contributors** — Team dynamics vary too much to draw conclusions.
- **Whether code was AI-generated** — Irrelevant. What matters is whether the code is *understood*, regardless of who or what wrote it.

## Confidence Dimensions

### Core Dimensions (4)

These are evaluated for every file in Phase 2 / Single File Mode:

#### 1. Test Safety Net

*Are there tests? Do they test the right things?*

- Read the test file(s) for the target module
- Check: do tests cover error paths and edge cases, or only happy paths?
- Check: are tests meaningful (not just `expect(true).toBe(true)`)?
- A file with no test file at all is an immediate risk signal

**Why it matters:** Tests are executable documentation of intent. If there are no tests, nobody has formally defined what this code is supposed to do.

#### 2. Self-Expressed Uncertainty

*Does the code itself say "I'm not confident"?*

Look for these markers (via grep or reading the file):

| Marker                      | What It Means                        |
| --------------------------- | ------------------------------------ |
| `TODO`                      | Acknowledged incomplete work         |
| `FIXME`                     | Known bug or issue                   |
| `HACK`, `WORKAROUND`, `XXX` | Intentional shortcut or band-aid     |
| `@ts-ignore`                | TypeScript safety bypassed           |
| `eslint-disable`            | Linting rules intentionally bypassed |
| Empty `catch {}` blocks     | Errors silently swallowed            |

**Why it matters:** The code is literally telling you where the risk is.

#### 3. Comprehensibility

*Can a newcomer understand this code?*

This requires reading the code and making a semantic judgment:

- **Naming quality:** Are variables, functions, and classes named descriptively? Or are there names like `data`, `temp`, `x`, `processStuff`?
- **Comment-to-complexity ratio:** Complex logic (regex, algorithms, state machines) should have proportionally more comments. Simple code needs fewer.
- **Function size and nesting:** Functions over ~50 lines or with 4+ levels of nesting are harder to follow.
- **Single responsibility:** Does each function/module do one thing, or is it a grab-bag?

**Why it matters:** If nobody can read it, nobody can fix it.

#### 4. Error Handling

*When things go wrong, do we get useful information?*

- **Empty catch blocks:** Errors caught but silently swallowed — the worst pattern
- **Generic error messages:** `throw new Error("failed")` gives zero debugging context
- **Unhandled edge cases:** What happens with null, undefined, empty arrays, concurrent access?
- **Error propagation:** Are errors properly propagated or lost in the call chain?

**Why it matters:** Bad error handling turns a 5-minute fix into a 5-hour hunt.

### Optional Dimension (1)

#### 5. Dependency Risk (project-level only)

*Are we building on shaky ground?*

This dimension is only evaluated when scanning at the project level (not per-file). Read `package.json` and check:

- Floating versions of critical dependencies (e.g., `"*"` or `">= 1.0.0"`)
- Known deprecated packages (based on AI training knowledge)

**Limitations:** Cannot check npm for maintenance status (requires network). Cannot assess per-file dependency risk. Use only as supplementary information.

## Interaction Strategy

### Scope: Clear → Start Immediately, Ambiguous → Confirm First

| User Expression                                     | Agent Behavior                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "Scan src/core/ for confidence"                     | Scope is clear (directory) → start **Directory Scan Mode**                                                 |
| "Is this file maintainable?" (while editing a file) | Scope is clear (current file) → start **Single File Mode**                                                 |
| "How's the code quality?" / "Where are the risks?"  | Scope is ambiguous → **ask first**: "Do you want to scan the entire project or a specific directory?"      |
| "I'm taking over this project"                      | Might be casual → **ask first**: "Would you like me to run a confidence scan to help you get an overview?" |

## Scan Workflow

### Single File Mode

When the target is a single file, skip Phase 1 and go directly into deep analysis:

1. Read the target source file
2. Find and read the corresponding test file (`foo.test.ts` or `foo.spec.ts`)
3. Grep the file for uncertainty markers
4. Evaluate the file against the 4 core dimensions
5. Output a single-file confidence report

### Directory Scan Mode

#### Phase 1: Quick Overview (low cost, no file content read)

Phase 1 only runs command-line tools. It does NOT read any source file contents. Use recursive commands to support nested directories:

```bash
# 1. Find source files (exclude test files)
find <target>/ -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts"

# 2. Find test files
find <target>/ -name "*.test.ts" -o -name "*.spec.ts"

# 3. Grep uncertainty markers across all source files
grep -rEc "TODO|FIXME|HACK" <target>/ --include="*.ts" --exclude="*.test.ts" --exclude="*.spec.ts"
grep -rEc "@ts-ignore|eslint-disable" <target>/ --include="*.ts" --exclude="*.test.ts" --exclude="*.spec.ts"
```

Present the results as an overview table:

```
Quick Scan: src/core/ (8 source files)

| File              | Tests | Markers | Bypasses |
| ----------------- | ----- | ------- | -------- |
| config-loader.ts  | Y     | 0       | 0        |
| lock-manager.ts   | Y     | 0       | 0        |
| skill-parser.ts   | Y     | 0       | 0        |
| cache-manager.ts  | Y     | 1       | 0        |
| agent-registry.ts | Y     | 0       | 0        |
| skill-manager.ts  | Y     | 0       | 0        |
| installer.ts      | Y     | 2       | 0        |
| git-resolver.ts   | Y     | 3       | 1        |

Suggested for deep analysis:
  1. git-resolver.ts — 3 unresolved markers + 1 type bypass
  2. installer.ts — 2 unresolved markers

The remaining 6 files have tests and no obvious markers.
Which files to analyze? All / Suggested only / Pick your own?
```

#### Phase 1 Suggestion Rules

The suggestion list is based on 3 reliable signals (highest priority first):

1. **No test file exists** → suggest for deep analysis
   - Exclusion rule (by filename, without reading content): files named `types.ts`, `type.ts`, files under a `types/` directory, and standalone `index.ts` files are excluded. This heuristic is imperfect but reasonable without reading file content.
2. **Uncertainty markers >= 2** → suggest for deep analysis (TODO / FIXME / HACK)
3. **Type/rule bypasses >= 1** → suggest for deep analysis (@ts-ignore / eslint-disable)

Files that don't match any of the above are NOT included in the suggestion list, but the user can still choose to analyze them manually.

#### Phase 2: Deep Analysis (after user chooses)

After the user selects which files to analyze, read each source file and its corresponding test file. Evaluate against the 4 core dimensions. Generate a confidence report with prioritized action items.

## Report Formats

### Single File Report

```
Code Confidence: src/core/git-resolver.ts
============================================
Level: LOW

Dimensions:
  Test Safety Net:         MEDIUM — Tests exist but only cover happy paths;
                           missing edge cases for SSH URLs and subgroups
  Self-Expressed Uncertainty: LOW — 3 TODOs (lines 45, 89, 112) + 1 @ts-ignore
  Comprehensibility:       MEDIUM — Regex-heavy but annotated with comments;
                           function naming is clear
  Error Handling:          LOW — Empty catch block on line 78;
                           error message on line 156 lacks context

Action Items:
  1. [HIGH IMPACT] Add edge-case tests for SSH URL parsing
  2. [HIGH IMPACT] Resolve TODO on line 45: "handle gitlab subgroups"
  3. [MEDIUM]      Line 78 empty catch — add meaningful error handling
                   or a comment explaining why the error is ignored
```

### Directory Scan Report (Phase 2)

```
Code Confidence Map
===================
Scope: src/core/
Phase 1 overview: 8 files (6 clean, 2 suggested for deep analysis)
Phase 2 analyzed: 2 files

| Module          | Level  | Key Finding                              |
| --------------- | ------ | ---------------------------------------- |
| git-resolver.ts | LOW    | 3 TODOs, regex-heavy, insufficient tests |
| installer.ts    | MEDIUM | High complexity, tests miss error paths  |

Action Items (prioritized):
  1. [HIGH IMPACT] git-resolver.ts — Add tests for SSH URL edge cases
  2. [HIGH IMPACT] git-resolver.ts — Resolve 3 TODOs (lines 45, 89, 112)
  3. [MEDIUM]      installer.ts — Add error-path tests for symlink failures

Not analyzed (6 files):
  config-loader.ts, lock-manager.ts, skill-parser.ts,
  cache-manager.ts, agent-registry.ts, skill-manager.ts
  — All have tests and no obvious markers (no risk signals in Phase 1)
```

## Examples

### Example 1: Single File Assessment

```
User: "Is this file safe to change?" (while editing src/core/installer.ts)

Agent:
1. Reads src/core/installer.ts
2. Finds and reads src/core/installer.test.ts
3. Greps for uncertainty markers: 2 TODOs found
4. Evaluates 4 dimensions
5. Reports:

   Code Confidence: src/core/installer.ts
   Level: MEDIUM

   Dimensions:
     Test Safety Net:         MEDIUM — Tests cover installation flows but
                              miss symlink failure and permission error paths
     Self-Expressed Uncertainty: MEDIUM — 2 TODOs (lines 89, 134)
     Comprehensibility:       HIGH — Clear function names, well-structured,
                              single responsibility per function
     Error Handling:          MEDIUM — Most errors caught but some error
                              messages could be more descriptive

   Action Items:
     1. [MEDIUM] Add tests for symlink creation failure scenarios
     2. [LOW]    Resolve TODO on line 89

   Overall: Reasonably safe to change. The main risk is untested error
   paths — consider adding error-path tests before making significant
   modifications.
```

### Example 2: Directory Scan

```
User: "Scan src/core/ for confidence"

Agent:
1. Runs Phase 1 (find + grep, no file reads)
2. Presents overview table with 8 files
3. Suggests 2 files for deep analysis

User: "Just the suggested ones"

Agent:
4. Reads git-resolver.ts + git-resolver.test.ts
5. Reads installer.ts + installer.test.ts
6. Evaluates each against 4 dimensions
7. Presents the directory scan report with action items
```

### Example 3: Ambiguous Request

```
User: "How's the code quality?"

Agent: "Do you want to scan the entire project, a specific directory,
or a single file? For example:
  - 'Scan src/core/' for the core module
  - 'Check src/cli/commands/' for CLI commands
  - Or name a specific file"
```

## Limitations

This skill is honest about what it can and cannot do:

**Can do:**
- Detect the presence/absence of test files
- Count uncertainty markers (TODO, FIXME, HACK, @ts-ignore, eslint-disable)
- Read code and make semantic judgments about naming, complexity, and error handling
- Provide actionable recommendations

**Cannot do:**
- Measure actual test coverage percentages (requires instrumentation tools)
- Assess runtime behavior or performance
- Determine if team members actually understand the code (social/organizational knowledge)
- Detect deprecated dependencies reliably (limited to AI training knowledge)
- Guarantee consistency across separate conversations (each scan is independent)

**Design choices:**
- Confidence is HIGH / MEDIUM / LOW, never a percentage — to avoid false precision
- Phase 1 suggestions use only reliable signals (no test file, marker count, bypass count) — no speculative heuristics
- The user always decides which files to deep-analyze — the agent does not make that decision autonomously
- LOW confidence is a risk signal, not a quality judgment — sometimes low-confidence code is perfectly fine if it's not on a critical path
