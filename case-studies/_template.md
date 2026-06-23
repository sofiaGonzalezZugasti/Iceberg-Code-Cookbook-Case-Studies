# Case Study: [Project ID] — [Short Name]

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP#####` |
| **Full name** | e.g. US – North Carolina Ethics Opinions (Attorney) |
| **Country** | e.g. US |
| **Source URL** | https://www.example.com |
| **Source type** | HTML / PDF / paginated HTML / login-gated / API / ZIP |
| **Hooks used** | getSeeds / fetchURL / discoverLinks / parsePage |
| **Status** | Done / In progress |
| **Owner** | Your name |

---

## What was crawled / parsed

Brief description of the source: what kind of documents, how many, how they are structured.

---

## Crawler

### Seed URLs
List the seed URLs used and why.

### Whitelist patterns
Paste the regex patterns and explain what each one matches.

### fetchURL strategy
Which pattern was used and why. Reference the snippet file if applicable:
→ `crawlers/fetchURL/url-type-router.js`

### discoverLinks strategy
→ `crawlers/discoverLinks/strict-pdf-filter.js`

---

## Parser

### URL patterns
What URLs does the parser target?

### parsePage strategy
Which pattern was used and why:
→ `parsers/parsePage/pdf-text-pipeline.js`

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `title` | `h1.first()` | |
| `date` | `meta[datePublished]` | |
| `body` | `div.content` | stripped header/footer |

---

## Challenges & Solutions

### Challenge 1: [Short description]
**Problem:** What went wrong or was non-obvious.
**Solution:** How you fixed it. Paste key snippet if it's not already in the cookbook.

### Challenge 2: [Short description]
**Problem:**
**Solution:**

---

## Gotchas

- Things that would trip up the next person working on a similar source.
- Edge cases to watch out for.
- Known limitations.

---

## Requirements doc
Link to the Google Doc with the original requirements.
