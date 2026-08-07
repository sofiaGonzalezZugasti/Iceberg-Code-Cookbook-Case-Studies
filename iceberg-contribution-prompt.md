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

   - If it's a CASE STUDY: output a ready-to-commit .md file following this structure:
     - Title (DP number + source name)
     - Source URL
     - Challenge: what made this source non-trivial
     - Solution: what approach solved it
     - Key snippets: the most important code fragments (with brief explanations)
     - Gotchas: things that would trip up someone doing this again

3. GIT INSTRUCTIONS: tell me exactly:
   - The full file path where the file should be saved
   - The branch name to use (format: snippet/<filename> or case-study/<dp-number>)
   - The commit message following the convention:
       add: <filename> <subfolder> pattern        (for snippets)
       add: case-study <dp-number> <source-name>  (for case studies)

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
   - The branch name and commit message to use

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

**For a case study** — paste your notes, even rough ones:
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
| Case study | `DP<number>-<source-slug>.md` | `DP74366-us-court-of-appeals-ca5.md` |
| Branch (snippet) | `snippet/<filename-no-extension>` | `snippet/aspnet-webforms-pagination` |
| Branch (case study) | `case-study/<dp-number>` | `case-study/DP74201` |
