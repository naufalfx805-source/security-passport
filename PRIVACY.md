# Security Passport: Privacy Policy

Last updated: 9 November 2026

Security Passport is a Forge app for Jira, built by Naufal, an independent developer, for Codegeist 2026. Contact: naufalfx805@gmail.com.

## What the app reads

When a Jira issue is created or edited, or when someone opens the Security Passport panel or uses its Rovo agent or MCP tools, the app reads that issue's summary, description, labels and components. It reads them to decide which security checks the work needs.

## What the app stores

The app stores one record per issue, the "Security Passport", as a Jira issue property named `security-passport` on that issue. The record contains:

- the security areas detected and the words that matched;
- the checks, with their status (open, done or accepted);
- the evidence or justification text that a person or agent entered when closing a check;
- for closed checks, the Atlassian account ID of the person who closed it and the time.

## Where the data stays

- Everything stays in your Jira site and runs on Atlassian's Forge platform.
- The app does not send data to any server of its own or to any third party.
- It keeps no database or copy outside your site, uses no analytics or tracking, and does not sell or share data.
- The developer cannot see your passports.

Atlassian's Forge platform may record error messages from the app. Site admins can choose not to share these logs with the developer. The app does not write issue content or personal data to logs.

## AI features

When you use the Security Passport Rovo agent, or connect an MCP client to the app's tools, the passport text is returned to Atlassian Rovo or to the MCP client you chose. Those services are covered by their own terms and privacy policies. The tools act with your own Jira permissions.

## Keeping and deleting data

- A passport lives as long as its issue. Deleting the issue deletes the passport.
- Uninstalling the app stops it from reading or writing issues. Passports already stored remain as issue properties until they are deleted, for example with Jira's REST API.

## Changes

Changes to this policy will be published at this address with a new date.
