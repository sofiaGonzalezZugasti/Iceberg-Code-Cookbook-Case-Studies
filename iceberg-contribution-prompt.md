# Iceberg Cookbook — Contribution Prompt

Copy and paste this prompt into Claude along with your code or case study.

---

## THE PROMPT

```
You are a contributor to the Iceberg Code Cookbook repository.
The repo is structured like this:

crawlers/
  getSeeds/        → How to generate seed URLs dynamically
  fetchURL/        → How to fetch pages (proxies, auth, JS rendering, binaries)
  discoverLinks/   → How to extract and filter links from pages

parsers/
  utilities/       → Reusable helper functions (dates, HTML cleanup, PDF extraction...)
  parsePage/       → How to extract structured records from crawled pages

case-studies/      → Real projects with challenges, solutions, and gotchas (Markdown files)

---

I'm going to give you a piece of code or a case study description. Your job is to:

1. CLASSIFY it: decide which folder and subfolder it belongs to, and suggest a filename
   following the existing naming convention (kebab-case, descriptive, no generic names).

2. FORMAT it:
   - If it's a CODE SNIPPET: output a ready-to-commit .js file with:
     - A comment block at the top explaining:
       - WHEN TO USE THIS: one sentence
       - HOW IT WORKS: 2-3 sentences max
       - WARNINGS / GOTCHAS: any edge cases or things to watch out for
     - The cleaned and readable code below

   - If it's a CASE STUDY: output a ready-to-commit .md file following this EXACT structure:

     # Case Study: <DP number> — <Full source name>

     ## Overview
     | Field | Value |
     |---|---|
     | **Project ID** | `DP<number>` |
     | **Full name** | <full source name> |
     | **Country** | <country> |
     | **Source URL** | <url> |
     | **Source type** | <e.g. "JSON API (search) + HTML detail pages + PDFs"> |
     | **Hooks used** | fetchURL, discoverLinks, parsePage |
     | **Status** | Done |

     ## What was crawled / parsed
     <1–3 sentences describing what the source contains and what was collected>

     ## Crawler

     ### Seed URLs
     <the seed URL(s)>

     ### Whitelist patterns
     <regex patterns used>

     ### fetchURL strategy
     <explain the approach: standard GET, POST, stateful form, binary download, etc.>
     <include the key code snippet if relevant>
     → `crawlers/fetchURL/<relevant-snippet>.js`

     ### discoverLinks strategy
     <explain how links are extracted and filtered>
     <include the key code snippet if relevant>
     → `crawlers/discoverLinks/<relevant-snippet>.js`

     ## Parser

     ### URL patterns
     <regex patterns that trigger this parser>

     ### parsePage strategy
     <explain what the parser does: routes by content type, extracts fields, merges records, etc.>
     <include key code snippet if relevant>

     ### Fields extracted
     | Field | Source | Notes |
     |---|---|---|
     | `fieldName` | where it comes from | any notes |

     ## Challenges & Solutions

     ### Challenge 1: <short title>
     **Problem:** <what went wrong or was non-trivial>
     **Solution:** <how it was solved>

     ### Challenge 2: <short title>
     ...

     ## Gotchas
     - <things that would trip someone up doing this again>
     - <hardcoded values that need updating>
     - <site-specific quirks>

3. FILENAME: the filename must be a kebab-case slug describing the TECHNICAL PATTERN,
   not the source name or DP number. The DP number goes inside the file, in the Overview table.

   Good examples:
     json-api-search-html-detail-pages-pdfs.md
     aspnet-webforms-stateful-pagination-pdfs.md
     recursive-json-tree-api-pagination-pdfs.md

   Bad examples (do NOT use these):
     DP74366-us-court-of-appeals-ca5.md   ← DP number in filename
     nc-ethics-opinions.md                ← source name, not technical pattern

4. GIT INSTRUCTIONS: tell me exactly:
   - The full file path where the file should be saved
   - The commit message following the convention:
       add: <filename> <subfolder> pattern        (for snippets)
       add: case-study <slug>                     (for case studies)

Here is my content:

[PASTE YOUR CODE OR CASE STUDY DESCRIPTION HERE]
```

---

## HOW TO USE

1. Copy the entire prompt above
2. Replace `[PASTE YOUR CODE OR CASE STUDY DESCRIPTION HERE]` with your code or notes
3. Paste into Claude and send
4. You'll get back:
   - The folder + filename where it goes
   - The file contents ready to copy-paste
   - The commit message to use

---

## EXAMPLES OF WHAT TO PASTE

**For a snippet** — paste the raw JS function, even if it's messy or incomplete:
```js
// my hacky pagination thing
function getSeeds() {
  let urls = []
  for (let y = 2010; y <= 2024; y++) {
    urls.push(`https://example.com/docs?year=${y}&type=ruling`)
  }
  return urls
}
```

**For a case study** — paste your notes, screenshots, and/or code, even rough:
```
DP74201 - Spanish Supreme Court
Problem: the site uses __VIEWSTATE and breaks if you don't send the right POST headers.
Solved it by grabbing the viewstate from the first GET and injecting it into the POST.
Also had to rotate session proxies because they block after ~50 requests.
The parser was straightforward once we had the HTML.
```

---

## NAMING CONVENTIONS (for reference)

| Type | Format | Example |
|---|---|---|
| Snippet | `kebab-case.js` | `aspnet-webforms-pagination.js` |
| Case study | `<technical-pattern-slug>.md` | `aspnet-webforms-stateful-pagination-pdfs.md` |
| Branch (snippet) | `snippet/<filename-no-extension>` | `snippet/aspnet-webforms-pagination` |
| Branch (case study) | `case-study/<slug>` | `case-study/aspnet-webforms-stateful-pagination-pdfs` |

> **Note:** The DP number goes inside the file (in the Overview table), not in the filename.
> The filename describes the technical pattern so anyone can recognise it matches their project at a glance.
