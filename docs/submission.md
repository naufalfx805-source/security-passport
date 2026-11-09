# Devpost submission draft (Codegeist 2026)

**Project name:** Security Passport

**Elevator pitch (under 200 characters):** Security checks that travel with the ticket: from Jira, to the pull request, to your AI coding agent. Forge app with a workflow gate, a Rovo agent and MCP tools.

**Category:** Apps for Software Teams

**Bonus prizes:** Best app with Atlassian MCP (primary). Also eligible for Best Agents (rovo:agent with three actions).

**Installation link (production, Jira):** https://developer.atlassian.com/console/install/73ed7a14-59de-41d1-8c1a-16b679c5860e?signature=AYABeOvNIg84QO1CLoYjaAMegCwAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBPXTm0cFT90jHC31R9mDuJgAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDPRr10DROkwrgKnABwIBEIA7vihvnErePSJIGsCGzix2Xasr0nkqE8AU5yjDxlNR3kSsTK2OE081WjeJQuK86r%2BOcc6OwLm8MnGuDQgAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFDF3nJ21UDLjpaj0k5wfXBAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM6iIEvy0tvK9zOCM%2BAgEQgDutOMOd2Ruo2ilhLS%2BTfgc1JHg0wt10lY2Pntd4lo8wATzk4nyY7yLRoBhnJwCy3LNlMnNAuhp57OO27AAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAX%2FLBasr%2FJW52aBN3QEmnx4AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzPtHXv80ZToMAZ%2FwoCARCAO9%2FMI53F3wJRVdZ2VFceuOySpE9u2Gwh1kFQZ3i1At4PyQvJP3ysbn1u0c38KXcO2zL54uWrvog1tgTQAgAAAAAMAAAQAAAAAAAAAAAAAAAAAHCTHbtvuntZNjRbXhzCM0T%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLEaivmJHaeVxFnJkPD%2Ba4NKhOZ63vnDJfAhpwExLodz%2BpagYH4SghyDDhVS32cn%2B3VCoqUMy238bWGpHInycCmufc%3D&product=jira

**Demo video (YouTube, public):** to add after upload. The file is C:\Users\naufa\Videos\security-passport-demo.mp4 (2:48, 1080p), with English subtitles in security-passport-demo.en.srt.

**Privacy policy and terms:** https://gist.github.com/naufalfx805-source/5116e3946a16a05fd0cb678cfdfba303

## About the project

### Inspiration
Most security bugs are not exotic. They come from ordinary tickets ("add a webhook", "import a CSV", "let admins invite users") whose risk nobody wrote down. AI coding agents make it worse: they build exactly what the ticket says, and the ticket says nothing about the risk.

### What it does
Security Passport reads every Jira ticket when it is created or edited and detects security-sensitive work: sign-in, permissions, URL fetching (SSRF), uploads, injection-prone input, secrets, personal data, payments, cryptography, destructive actions, dependencies and redirects. It gives the ticket a **passport**: a short list of concrete checks, each with a CWE reference and a test idea. The team closes checks with evidence or accepts a risk with a written justification. A workflow validator keeps the ticket out of Done until the passport is complete. The same checks are available to Rovo and to any MCP client, so AI agents get the security requirements before they write code.

### How we built it
All Forge:
- a `trigger` on issue created and updated;
- a UI Kit `jira:issuePanel`;
- a `jira:workflowValidator` written as a Jira expression;
- a `jira:entityProperty` index for JQL;
- three `action` modules shared by a `rovo:agent` and a `rovo:mcp` server;
- an open-source `skill.md` that teaches coding agents to fetch the passport, test each check and record evidence.

Detection is deterministic and explainable: every area shows the words that triggered it. The panel and the actions use `asUser()`, so Jira permissions decide who can change a passport.

### Challenges
- Making the gate impossible to clear by editing the ticket text: checks are never dropped, only marked as no longer detected.
- Keeping the agent honest: tools refuse to close a check without evidence, and accepting a risk stays a human decision.

### What's next
A Bitbucket merge check that reads the linked ticket's passport, team-specific rule packs, and Confluence policy pages as a source of checks.

## Bonus write-up: Best app with Atlassian MCP
The app declares a `rovo:mcp` module exposing `get-security-passport`, `list-open-security-checks` and `record-security-evidence`. The repository ships `skills/security-passport/SKILL.md`, an open-source skill for third-party agents such as Claude Code. It describes when to call each tool, what counts as evidence, and why the agent must never accept a risk itself. The demo video shows a coding agent fetching the passport, writing the SSRF test and recording the evidence back on the Jira issue.

## Testing instructions for judges
See "Try it (for judges)" in README.md. After installing from the link, create an issue with the summary "Add a webhook that fetches the customer's logo from a URL" and open the Security Passport panel (if it is not shown yet, use the issue's "View app actions" menu, then Security Passport). The workflow validator is optional and is added in the workflow editor (transition into Done, "Security Passport complete").
