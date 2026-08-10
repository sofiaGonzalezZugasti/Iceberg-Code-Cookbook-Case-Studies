# Platform Bug: Tests tab ignores transcoding filter, shows scrambled PDF text

## Overview

| Field | Value |
|---|---|
| **Component** | Parser Tests tab (PDF transcoding filter selection) |
| **Severity** | `Medium` |
| **Status** | `Open` |
| **Ticket** | `ICEATC-86` |
| **Affected DP(s)** | `DP74392` |
| **Reported by** | @facundoherrera-content-bcn |
| **Fixed in** | N/A |

---

## Symptoms

PDF text comes out scrambled/reordered (e.g. `"STATE"` split into `"STA"` / `"TE"`),
identically across **all 4 filter options** in the Tests tab dropdown — including with
OCR explicitly selected. Debug fields (HTML length, head, tail) are identical between
all 4 options, which is what exposes this as a platform issue rather than a source PDF
problem.

---

## Conditions to Reproduce

1. Run a PDF parser test via the **Tests tab**, selecting any transcoding filter from
   the dropdown (including a non-default one, or OCR).
2. The output is identical to running with the default filter (`pdf2htmlEX`) — the
   dropdown selection has no effect.

---

## Root Cause

Confirmed by the Iceberg team (Álvaro): the Tests tab always runs with an **empty
filter list**, falling back to the default filter regardless of the dropdown
selection. The **Configuration tab**'s filter setting is the one actually honored on
real crawl runs and in the "Crawled File" view.

---

## Workaround

Never validate a transcoding filter change via the Tests tab. Validate instead via
**Configuration tab + "Crawled File" view** — those reflect the real filter used in
production. In `DP74392`, switching the real filter from `PDF to HTML EX fallback` to
`PDF to Text (pdftotext)` in Configuration fixed the scrambled-text cases.

---

## Fix

N/A — confirmed as a real platform bug, tracked as `ICEATC-86`, still open.

---

## Notes

- Scrambled/reordered PDF text is not always source corruption — check which filter is
  actually being applied (via Configuration, not Tests) before assuming the source
  document itself is broken.
- If a PDF-transcoding issue looks identical across every filter option in the Tests
  tab, suspect the Tests tab itself before suspecting the source PDF.
