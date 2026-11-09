# Security Passport

**Security checks that travel with the ticket: from Jira, to the pull request, to your AI coding agent.**

A Forge app for Jira, built for Codegeist 2026 (category: Apps for Software Teams; bonus: Best app with Atlassian MCP, and Rovo agents).

## The problem

Security requirements show up too late. A ticket says "add a webhook" or "let users import a CSV", nobody spells out that this means SSRF protection or zip-bomb limits, and the gap is found in review, in a pen test, or in production. AI coding agents make this worse: they write the feature exactly as the ticket describes it, and the ticket does not describe the risk.

## What it does

1. **Reads every ticket** when it is created or edited and detects security-sensitive work from its wording: sign-in, permissions, URL fetching (SSRF), uploads, injection-prone input, secrets, personal data, payments, cryptography, destructive actions, dependencies and redirects. Detection is deterministic and explainable: the panel shows the exact words that triggered each area.
2. **Gives the ticket a Security Passport**: a short list of concrete checks, each with a CWE reference and a "how to verify" test idea. It is stored as a Jira issue property, so it travels with the issue and is searchable in JQL (`securityPassportStatus = "open"`).
3. **Lets the team close checks with evidence** (a test name, a pull request, a review note) or **accept a risk with a written justification**, both attributed to the person who did it.
4. **Gates the workflow**: the "Security Passport complete" validator stops the ticket from moving to Done while checks are open.
5. **Hands the checks to AI agents**: a Rovo agent and an MCP server (`rovo:mcp`) expose `get-security-passport`, `list-open-security-checks` and `record-security-evidence`. The open-source [skill](skills/security-passport/SKILL.md) tells coding agents such as Claude Code to fetch the passport before coding, test each check, and record evidence afterwards.

Editing the ticket text never clears the gate. If an area stops matching, its checks stay and are marked "no longer in the ticket text".

## Forge modules

| Module | Purpose |
|---|---|
| `trigger` (`avi:jira:created:issue`, `avi:jira:updated:issue`) | Re-analyzes the ticket and updates its passport |
| `jira:issuePanel` (UI Kit) | Shows the passport; close checks with evidence or accept a risk |
| `jira:workflowValidator` (Jira expression) | Blocks transitions while the passport is open |
| `jira:entityProperty` | Indexes status, open count and areas for JQL |
| `action` ×3 | Shared tools for the Rovo agent and the MCP server |
| `rovo:agent` | "Security Passport" agent in Rovo |
| `rovo:mcp` | Exposes the actions as MCP tools |

Scopes: `read:jira-work`, `write:jira-work`. The panel and the actions read and write as the current user (`asUser`), so Jira permissions decide who can change a passport. Only the trigger runs as the app.

## Develop

    npm install
    npm test                 # engine tests (node:test)
    forge register           # once, to get an app ID
    forge deploy
    forge install --site <your-site>.atlassian.net --product jira

Then, in a company-managed project's workflow, add the validator "Security Passport complete" to the transition into Done.

## Try it (for judges)

1. Install the app from the installation link in the submission.
2. Create an issue with the summary "Add a webhook that fetches the customer's logo from a URL". Open the issue: the Security Passport panel lists the SSRF checks and the words that triggered them.
3. Mark SSRF-1 as done with evidence such as `test_rejects_private_addresses`, or accept a risk with a justification.
4. Optional: add the "Security Passport complete" validator to the Done transition and try to close the issue while checks are open.
5. Optional: in Rovo, ask the Security Passport agent "Which security checks does SEC-1 need?". To record evidence, tell it which check is covered and how ("SSRF-1 is covered by test_rejects_private_addresses in PR #42"). Rovo asks you to confirm before anything is written.

## Connect an MCP client (Atlassian MCP, Preview)

The same three tools are served by the Atlassian MCP server at:

    https://mcp.atlassian.com/forge/73ed7a14-59de-41d1-8c1a-16b679c5860e

1. A site admin turns them on once per site: [admin.atlassian.com](https://admin.atlassian.com) → your organization → **Apps** → **Atlassian apps** → "Looking for your Marketplace and third-party apps?" (the site's **Connected apps**) → **Security Passport** → **View app details** → **Tools: Expose tools to MCP-compatible apps** → **Enable tools**.
2. Add the URL to your MCP client as a remote (streamable HTTP) server. With Claude Code:

       claude mcp add --transport http security-passport https://mcp.atlassian.com/forge/73ed7a14-59de-41d1-8c1a-16b679c5860e

   then run `/mcp` and choose **Authenticate**. The Atlassian consent screen asks which site to use.
3. Ask the agent "What security checks does SEC-1 need?", or give it the [skill](skills/security-passport/SKILL.md) so it fetches the passport before it writes code and records evidence when a check is covered.

The tools run as the signed-in user, so Jira permissions still decide what they can read and change. Their names carry the app environment as a suffix, for example `get-security-passport_development` on a development install.

For a scripted check without an AI client, `node scripts/mcp-smoke.mjs SEC-1` signs in through the browser, lists the tools and reads the passport of SEC-1 (add `--record CHECK-ID "evidence"` to test the write tool). Tokens stay in memory and are revoked at the end.

## Privacy and terms

The app keeps everything in your Jira site: see the [privacy policy](PRIVACY.md) and [terms of service](TERMS.md), also published at https://gist.github.com/naufalfx805-source/5116e3946a16a05fd0cb678cfdfba303 for the installation page.

## License

MIT. See [LICENSE](LICENSE).
