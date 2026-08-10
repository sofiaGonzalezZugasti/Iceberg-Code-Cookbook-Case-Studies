# Platform Bug: Code editor cache reverts saved code silently

## Overview

| Field | Value |
|---|---|
| **Component** | Parser Code editor / Preview (Relay cache) |
| **Severity** | `High` |
| **Status** | `Resolved` |
| **Ticket** | `ICEATC-103` |
| **Affected DP(s)** | `DP76181` (same pattern suspected on the Project detail page's "owner" field, tracked separately by the platform team) |
| **Reported by** | @facundoherrera-content-bcn |
| **Fixed in** | `PR vlex-iceberg-tools#1955` |

---

## Symptoms

Preview for a specific URL keeps returning the same stale result even after saving a
real code change. Isolating the problem shows the Code tab itself displays the *old*
version of the code again after running Preview — the save request reaches the server,
but the response doesn't come back with the freshly saved code, so the editor's local
cache stays on the old version.

---

## Conditions to Reproduce

1. Open a parser's Code tab, make a real change, save it.
2. Run Preview against a specific URL.
3. The Code tab reverts to displaying the pre-save version of the code, even though the
   save reached the server successfully.

**Risk:** if you save again while the editor is showing the reverted version, that old
version gets written for real — overwriting the actual code with **no trace left in
the revision history**. This happened in `DP76181`: a version of a fix was lost and
never appears in the history.

---

## Root Cause

Confirmed by the Iceberg team: an editor cache bug (Relay), not an autosave issue. The
save itself works; the UI's local cache simply doesn't get invalidated with the fresh
saved code after the response comes back.

---

## Workaround

- Save a code change only once per edit.
- Hard-refresh the page before trusting what Preview shows.
- Never save again if the editor looks reverted — treat that as a signal to refresh,
  not to re-save.
- To isolate whether a stuck Preview result is this cache bug vs. an actual code
  regression, test against a fresh URL that was never evaluated by this parser before.

---

## Fix

Merged in `vlex-iceberg-tools#1955`, tracked in Linear as `ICEATC-103`. Deploy was in
progress at the time this was documented.

---

## Notes

- The team flagged the same pattern is suspected on the Project detail page's "owner"
  field — tracked separately, not covered by this same fix.
- If Preview looks "stuck" on an old result after a confirmed-saved code change, check
  whether the Code tab itself is showing the reverted version before assuming your fix
  didn't work.
