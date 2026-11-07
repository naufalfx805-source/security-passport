---
name: security-passport
description: Use before implementing, reviewing or closing a Jira ticket in a project that runs the Security Passport app. Fetches the ticket's security checks through the Atlassian MCP server, builds and tests each one, and records the evidence back on the ticket so it can ship.
---

# Security Passport for coding agents

Security Passport is a Forge app for Jira. For every ticket that touches sign-in, permissions, uploads, URL fetching, payments, secrets, personal data or other risky areas, it keeps a list of security checks (the "passport"). Each check has an ID, a CWE reference, the risk, how to verify it, and a status. A Jira workflow validator can block the ticket from moving to Done while checks are open.

This skill lets an AI coding agent use that context while it writes the code, instead of discovering the requirements in review.

## Setup

The app exposes three tools through the Atlassian MCP server (Forge `rovo:mcp` module):

| Tool | What it does |
|---|---|
| `get-security-passport` | Returns the checks for one issue key, with status and how to verify each. |
| `list-open-security-checks` | Lists issues whose passport still has open checks, optionally for one project. |
| `record-security-evidence` | Marks one check as done and stores the evidence. |

Connect your agent to the Atlassian MCP server for your site, with Security Passport installed and its tools enabled for external clients by a site admin. The tools run with your own Jira permissions.

## Workflow

1. **Before writing code**, call `get-security-passport` with the ticket key (for example `SEC-12`). Read every open check.
2. **Plan the change around the checks.** For each open check, decide which code path handles it and which test proves it. Use the "How to verify" text as the starting test case.
3. **Write the tests first** for the checks that apply, then the implementation. Keep each test named after the check, for example `test_ssrf_1_rejects_private_addresses`.
4. **Run the tests.** Only when a test for a check passes, call `record-security-evidence` with the issue key, the check ID and concrete evidence: the test name and the commit or pull request link.
5. **Report back to the user**: which checks you closed (with evidence), which are still open and why.

## Rules

- Never close a check without evidence you produced or verified in this session. A passing test, a pull request link or a reviewer's note counts; "looks fine" does not.
- Never accept a risk on the user's behalf. Accepting a risk needs a person's written justification in the Security Passport panel in Jira.
- If the passport says no checks are needed but your change does touch a risky area (for example it starts fetching user-supplied URLs), tell the user and suggest adding the matching label, such as `security-passport:ssrf`, so the ticket gets its checks.
- If a tool call fails because of permissions, stop and tell the user; do not retry with other credentials.
