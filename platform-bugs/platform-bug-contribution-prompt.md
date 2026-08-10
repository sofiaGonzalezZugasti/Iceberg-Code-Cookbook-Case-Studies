# Platform Bug — Contribution Prompt

Copy and paste this prompt into Claude along with your bug description.

---

## THE PROMPT

```
You are a contributor to the Iceberg Code Cookbook repository.
This is the platform-bugs/ folder, which documents bugs in the Iceberg platform itself
(not scraping sources). Examples: crawler crashes, UI bugs, editor issues, filter problems.

Each bug report follows this structure:

- Overview table: component, severity, status, ticket, affected DPs, reporter, fix
- Symptoms: what the developer sees when the bug occurs
- Conditions to Reproduce: steps or conditions that trigger it
- Root Cause: what is actually going wrong (if known)
- Workaround: what to do right now while the bug is open
- Fix: what was merged to resolve it (if resolved)
- Notes: Slack threads, related bugs, extra context

I'm going to describe a platform bug. Your job is to:

1. FORMAT it as a ready-to-commit .md file following the structure above exactly.
   Leave "Under investigation" for Root Cause if unknown.
   Leave N/A for Ticket or Fix if not available yet.

2. FILENAME: kebab-case describing the bug symptom or affected component, not the DP number.
   The DP number goes inside the file, in the Overview table.

   Good examples:
     puppeteer-playwright-manager-crash-kills-crawl-job.md
     code-editor-cache-reverts-saved-code-silently.md
     tests-tab-ignores-transcoding-filter-shows-scrambled-pdf.md

3. GIT INSTRUCTIONS: tell me exactly:
   - The full file path: platform-bugs/<filename>.md
   - The commit message: add: platform-bug <filename>

Here is my bug description:

[PASTE YOUR BUG DESCRIPTION HERE]
```

---

## HOW TO USE

1. Copy the entire prompt above
2. Replace `[PASTE YOUR BUG DESCRIPTION HERE]` with your notes — Slack messages,
   screenshots, ticket description, whatever you have
3. Paste into Claude and send
4. You'll get back:
   - The formatted .md file ready to commit
   - The filename and commit message to use

---

## WHAT TO INCLUDE IN YOUR DESCRIPTION

The more context the better, but even rough notes work. Useful things to include:

- What component broke (puppeteerManager, code editor, Tests tab, etc.)
- What you saw happening (crash, wrong output, silent revert, etc.)
- When / under what conditions it happens
- Whether there's a ticket (ICEATC-xxx)
- Which DPs were affected
- Whether it's already fixed or still open
- Any workaround you found

---

## NAMING CONVENTIONS

| Type | Format | Example |
|---|---|---|
| Bug report | `<symptom-or-component-slug>.md` | `tests-tab-ignores-transcoding-filter.md` |
| Commit | `add: platform-bug <filename>` | `add: platform-bug tests-tab-ignores-transcoding-filter` |

> **Note:** The DP number and ticket go inside the file, not in the filename.
