# Demo video script (target 4:30, hard limit under 5:00)

Recorded on a Jira test site with a project called SEC. Every ticket and value shown is made up.
Judging weights: Technology 20%, Design 20%, Impact 20%, Innovation 20%, Presentation 20%.
The video has to prove the app works end to end, and say who it is for and why it matters.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:20 | Jira board, then a ticket: "Add a webhook that fetches the customer's logo from a URL" | "This ticket looks harmless. It is also a server-side request forgery bug waiting to happen, and nothing in it says so. An AI coding agent will build exactly what it says." |
| 0:20–0:45 | Slide: ticket → code → review → pen test, with the risk found at the end | "Security requirements usually arrive in review or in a pen test, long after the code is written. Security Passport moves them into the ticket, where people and agents actually look." |
| 0:45–1:35 | Create the ticket. Open the Security Passport panel | "As soon as the ticket is saved, Security Passport reads it. It found URL fetching and a webhook, and gave the ticket three checks. Each has a CWE reference and a concrete test. You can see exactly which words triggered it; nothing is a black box." |
| 1:35–2:10 | Mark SSRF-1 done with evidence `test_rejects_private_addresses (PR #42)`. Accept SSRF-3 with a justification | "Closing a check needs evidence: a test, a pull request or a review note. Accepting a risk needs a written reason. Both are recorded with who did it and when." |
| 2:10–2:40 | Try to move the ticket to Done: the validator error appears. Close the last check and move it to Done | "The workflow validator blocks Done while checks are open. Editing the ticket text does not clear the gate: checks stay until someone closes them." |
| 2:40–3:00 | Issue search with `securityPassportStatus = "open"` | "The passport is an indexed issue property, so leads can find every open security check with JQL." |
| 3:00–3:40 | Rovo chat with the Security Passport agent: "Which security checks does SEC-1 need?" | "In Rovo, the Security Passport agent answers from the passport. It never invents checks, and it will not accept a risk for you." |
| 3:40–4:15 | Coding agent with the Atlassian MCP server and the open-source skill: it fetches the passport, writes the SSRF test, runs it, records the evidence. The Jira panel updates | "The same tools are exposed through the Atlassian MCP server. With our open-source skill, a coding agent fetches the passport before it writes a line, tests each check, and records the evidence back on the ticket." |
| 4:15–4:35 | Slide: the Forge modules (trigger, UI Kit panel, workflow validator, entity property, actions, rovo:agent, rovo:mcp) | "Under the hood it is all Forge: one trigger, a UI Kit panel, a Jira-expression validator, an indexed property and three actions shared by Rovo and MCP. It reads and writes as the current user, so Jira permissions still apply." |
| 4:35–4:50 | Title card: "Security Passport: security checks that travel with the ticket" | "Security Passport. Security checks that travel with the ticket, from Jira, to the pull request, to your AI agent." |

Recording notes:
- 1080p, browser zoom 110%, light theme, no personal data on screen.
- Record each row separately, then join them. Keep the narration close to the table; it fits in about 4:40.
- Upload to YouTube as Public and paste the link into the Devpost submission.
