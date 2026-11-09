// Rule catalog: which ticket wording signals which security area, and the
// checks that area needs. Deterministic on purpose, so every check can be
// explained by the words that triggered it.
//
// A check may carry `when`: a pattern the ticket text must also match for that
// check to apply (for example, password hashing only when passwords are
// mentioned). Checks without `when` always apply to their area.

export const RULES_VERSION = 2;

export const RULES = [
  {
    id: 'auth',
    label: 'Authentication and sessions',
    patterns: [
      /\blog ?in\b/, /\bsign[- ]?(in|up)\b/, /\bpasswords?\b/, /\b(mfa|2fa)\b/, /\btwo[- ]factor\b/,
      /\b(sso|saml|oauth2?|oidc)\b/, /\bsessions?\b/, /\bjwt\b/, /\b(forgot|reset) password\b/, /\bmagic link\b/,
    ],
    checks: [
      { id: 'AUTH-1', cwe: 'CWE-307', title: 'Rate-limit and lock out repeated failed sign-in, reset and MFA attempts.', verify: 'Automated test: the 6th wrong password within a minute is rejected and logged; the reset endpoint is throttled per account and per IP.' },
      { id: 'AUTH-2', cwe: 'CWE-384', title: 'Issue a new session ID at sign-in and invalidate it at sign-out and on password change.', verify: 'Test: the session cookie changes after login, and the old cookie is rejected after logout and after a password change.' },
      { id: 'AUTH-3', cwe: 'CWE-640', title: 'Reset and magic-link tokens are random, single-use, short-lived and bound to one account.', verify: 'Test: a used or expired token is rejected, and tokens carry at least 128 bits of randomness.' },
    ],
  },
  {
    id: 'access',
    label: 'Authorization and access control',
    patterns: [
      /\bpermissions?\b/, /\broles?\b/, /\badmins?\b/, /\baccess control\b/, /\bauthori[sz]ation\b/,
      /\bsharing\b/, /\bshare (link|with)\b/, /\btenants?\b/, /\bownership\b/, /\binvit(e|es|ation)\b/,
    ],
    checks: [
      { id: 'ACCESS-1', cwe: 'CWE-862', title: 'Check authorization on the server for every new endpoint or action, not only in the UI.', verify: 'Test each new endpoint as an anonymous user and as a user without the role: both get 401 or 403.' },
      { id: 'ACCESS-2', cwe: 'CWE-639', title: "Load objects by ID only inside the caller's own scope (tenant, project or owner).", verify: "Test: user A requesting user B's object ID gets 403 or 404." },
      { id: 'ACCESS-3', cwe: 'CWE-269', title: 'Role and permission changes are limited to admins and written to the audit log.', verify: 'Test: a non-admin cannot change roles, and every change creates an audit entry.' },
    ],
  },
  {
    id: 'ssrf',
    label: 'Server-side requests to URLs (SSRF)',
    patterns: [
      // Outgoing webhooks only: the server calls a URL someone else chose.
      /\b(outgoing|send|sends|sending|fire|fires|firing|call|calls|calling|deliver|delivers|delivering)\b[^.\n]{0,30}\bwebhooks?\b/,
      /\bwebhooks? (url|target)s?\b/, /\bwebhooks? (that|to) (call|fetch|post|notify|ping)/,
      /\bcallback url\b/, /\bfetch(es|ing)? (a |the )?(remote |external )?(url|link|image|page|feed|file)s?\b/,
      /\bfrom (a |the )?url\b/, /\bimport (from )?(a )?url\b/, /\blink previews?\b/, /\bunfurl/, /\bproxy\b/,
      /\bremote (image|file|url|resource)s?\b/, /\bdownload (it )?from\b/, /\$ref\b/, /\brss\b/,
    ],
    checks: [
      { id: 'SSRF-1', cwe: 'CWE-918', title: 'Resolve the destination and block private, loopback, link-local and cloud-metadata addresses before connecting, again after every redirect.', verify: 'Unit test rejects http://127.0.0.1, http://[::1], http://169.254.169.254/latest/meta-data/ and a hostname that resolves to 10.0.0.1.' },
      { id: 'SSRF-2', cwe: 'CWE-918', title: 'Allow only https (and an allowlist of hosts where possible); disable or cap redirects.', verify: 'Test: file://, gopher:// and http:// to an internal host are refused, and so is a redirect to an internal address.' },
      { id: 'SSRF-3', cwe: 'CWE-400', title: 'Set connect and read timeouts and a maximum response size.', verify: 'Test: a slow response and a 1 GB response are cut off without exhausting the worker.' },
    ],
  },
  {
    id: 'upload',
    label: 'File uploads and parsing',
    patterns: [
      /\buploads?\b/, /\battachments?\b/, /\bimport (a |the )?(csv|xlsx|zip|pdf|json|xml|file)s?\b/,
      /\b(csv|zip|pdf|xml) (import|parser|parsing)\b/, /\bparse (the )?(pdf|xml|zip|csv)\b/, /\bavatars?\b/,
      /\bprofile (photo|picture)\b/, /\bextract (the )?(zip|archive)\b/,
    ],
    checks: [
      { id: 'UPLOAD-1', cwe: 'CWE-434', title: 'Check file type by content, enforce a size limit, and store uploads outside the web root under generated names.', verify: 'Test: a renamed .html or .svg file is rejected or served as a download, and an oversized file is rejected.' },
      { id: 'UPLOAD-2', cwe: 'CWE-22', title: 'Archive and path handling cannot leave the target folder and caps the total extracted size.', verify: 'Test: a zip containing ../../evil.txt and a zip bomb are both rejected.' },
      { id: 'UPLOAD-3', cwe: 'CWE-611', title: 'XML and office parsers have external entities disabled.', verify: 'Test: an XXE payload that references file:///etc/passwd is not resolved.' },
    ],
  },
  {
    id: 'injection',
    label: 'Injection (queries, HTML, commands)',
    patterns: [
      /\bsearch\b/, /\bfilter(s|ing)?\b/, /\bsort(ing)? by\b/, /\braw (sql|quer(y|ies))\b/, /\bsql\b/, /\bjql\b/,
      /\btemplates?\b/, /\brich text\b/, /\bmarkdown\b/, /\bhtml\b/, /\bwysiwyg\b/, /\bshell\b/, /\bcommand line\b/, /\beval\b/,
    ],
    checks: [
      { id: 'INJ-1', cwe: 'CWE-89', title: 'Bind every user value as a query parameter, and allowlist sort and filter field names.', verify: "Test: a filter value of ' OR 1=1 -- and a sort field of name;DROP TABLE are handled safely." },
      { id: 'INJ-2', cwe: 'CWE-79', title: 'Encode output for its context and sanitize user HTML or Markdown with an allowlist sanitizer.', verify: 'Test: <img src=x onerror=alert(1)> in the field renders as text or is stripped.' },
      { id: 'INJ-3', cwe: 'CWE-78', title: 'Never pass user input to a shell, eval or template engine; use argument arrays and fixed templates.', verify: 'Test: input containing ; | $( ) and {{7*7}} is not executed or evaluated.' },
    ],
  },
  {
    id: 'secrets',
    label: 'Secrets and credentials',
    patterns: [
      /\bapi[ -]?keys?\b/, /\bsecrets?\b/, /\bcredentials?\b/, /\b(access|refresh|bearer|personal access) tokens?\b/,
      /\bprivate keys?\b/, /\benvironment variables?\b/, /\.env\b/, /\b(vault|kms)\b/,
    ],
    checks: [
      { id: 'SECRET-1', cwe: 'CWE-798', title: 'No secrets in code, tickets, logs or client bundles; load them from the secret store at run time.', verify: 'Run a secret scanner such as gitleaks on the branch, and search the test-run logs for the token value.' },
      { id: 'SECRET-2', cwe: 'CWE-312', title: 'Store tokens encrypted at rest, show them only once, and support rotation and revocation.', verify: 'Test: the stored value is not the plaintext token, and a revoked token is rejected.' },
      { id: 'SECRET-3', cwe: 'CWE-532', title: 'Mask secrets in logs, error messages and analytics events.', verify: 'Test: an error that includes the token produces a log line with the value masked.' },
    ],
  },
  {
    id: 'pii',
    label: 'Personal data',
    patterns: [
      /\bpersonal data\b/, /\bpii\b/, /\bemail address(es)?\b/, /\bphone numbers?\b/, /\b(home|shipping|billing) address(es)?\b/,
      /\bdate of birth\b/, /\bbirthday\b/, /\bpassport (numbers?|scans?|photos?|data|details|copy|copies)\b/, /\bnational id\b/, /\b(ssn|ktp|nik)\b/, /\b(gdpr|ccpa)\b/,
      /\bprivacy\b/, /\bexport (all )?(users|customers|contacts)\b/, /\banalytics\b/, /\btracking\b/, /\b(medical|health) (data|records?)\b/,
    ],
    checks: [
      { id: 'PII-1', cwe: 'CWE-359', title: 'Collect and return only the personal fields the feature needs, and mask them in lists and exports.', verify: 'Review the API response for extra personal fields, and check that exports mask or omit sensitive columns.' },
      { id: 'PII-2', cwe: 'CWE-532', title: 'Keep personal data out of logs, error reports and analytics.', verify: 'Test: a request containing an email address or phone number does not write it to logs or analytics payloads.' },
      { id: 'PII-3', cwe: null, title: 'Deletion and retention rules cover the new data, including exports and backups.', verify: 'Test: deleting the account removes the new fields; the retention period is written down in the ticket.' },
    ],
  },
  {
    id: 'payments',
    label: 'Payments and money movement',
    patterns: [
      /\bpayments?\b/, /\bcheckout\b/, /\bbilling\b/, /\binvoices?\b/, /\brefunds?\b/, /\bsubscriptions?\b/,
      /\b(stripe|paypal|midtrans|xendit)\b/, /\bwallets?\b/, /\b(credit card|card number)s?\b/,
      /\b(coupon|discount code|promo code|voucher)s?\b/, /\bpric(e|es|ing)\b/,
    ],
    checks: [
      { id: 'PAY-1', cwe: 'CWE-602', title: 'Compute amounts, prices and discounts on the server; never trust an amount sent by the client.', verify: 'Test: changing the amount or quantity in the request does not change the charged total.' },
      { id: 'PAY-2', cwe: 'CWE-345', when: /\b(webhooks?|callbacks?|notifications?|events?)\b/, title: 'Verify payment-provider webhook signatures and make the handlers idempotent.', verify: 'Test: an unsigned or replayed webhook is rejected, and delivering the same event twice changes state once.' },
      { id: 'PAY-3', cwe: 'CWE-362', when: /\b(balances?|wallets?|coupons?|vouchers?|refunds?|credits?|points|discount codes?|promo codes?|redeem|top[- ]?up)\b/, title: 'Prevent double spending with locks or idempotency keys on balance, coupon and refund changes.', verify: 'Test: two concurrent requests that redeem the same coupon succeed only once.' },
    ],
  },
  {
    id: 'webhook-in',
    label: 'Incoming webhooks',
    patterns: [
      /\b(incoming|inbound|receive|receives|receiving|handle|handles|handler for)\b[^.\n]{0,30}\bwebhooks?\b/,
      /\bwebhooks?\b[^.\n]{0,40}\b(signature|signed|verify|verifies|verification)\b/,
      /\b(signature|verify|verifies)\b[^.\n]{0,40}\bwebhooks?\b/,
    ],
    checks: [
      { id: 'HOOK-1', cwe: 'CWE-345', title: "Verify the sender's signature over the raw request body, with a constant-time compare, before parsing it.", verify: 'Test: a request with a missing or wrong signature, or a changed body, is rejected with 401 and has no side effects.' },
      { id: 'HOOK-2', cwe: 'CWE-294', title: 'Reject replays: check the signed timestamp window and remember processed event IDs.', verify: 'Test: replaying a valid delivery after 5 minutes, or a second time, is rejected.' },
      { id: 'HOOK-3', cwe: 'CWE-20', title: "Treat the payload as a hint: re-read authoritative state from the provider's API before acting on amounts or statuses.", verify: 'Test: a correctly signed event carrying a different amount does not change the stored amount.' },
    ],
  },
  {
    id: 'crypto',
    label: 'Cryptography and tokens',
    patterns: [
      /\bencrypt(ion|ed|s)?\b/, /\bdecrypt(ion|ed|s)?\b/, /\bhash(es|ing)?\b/, /\b(digital|cryptographic) signatures?\b/,
      /\bsign(s|ing)? (the )?(payload|request|url|token|jwt)s?\b/, /\bhmac\b/,
      /\brandom (tokens?|codes?|ids?)\b/, /\botp\b/, /\b(certificates?|tls|ssl)\b/, /\b(bcrypt|argon2|scrypt|pbkdf2|sha-?1|md5)\b/,
    ],
    checks: [
      { id: 'CRYPTO-1', cwe: 'CWE-327', when: /\b(encrypt|decrypt|digital signatures?|cryptographic|sign(s|ing)?|hmac|certificates?|tls|ssl|sha-?1|md5|keys?)\b/, title: 'Use vetted library primitives (AES-GCM or libsodium) with keys from the key store; no custom crypto or fixed IVs.', verify: 'Code review: no ECB, MD5 or SHA-1 used for security, and no keys in the repository.' },
      { id: 'CRYPTO-2', cwe: 'CWE-916', when: /\b(passwords?|passphrases?|bcrypt|argon2|scrypt|pbkdf2)\b/, title: 'Hash passwords with Argon2id, scrypt or bcrypt and a per-user salt.', verify: 'Test: the stored hash uses the chosen algorithm and work factor.' },
      { id: 'CRYPTO-3', cwe: 'CWE-330', when: /\b(random|tokens?|codes?|otp|ids?|nonces?|hmac|compare|comparison)\b/, title: 'Generate tokens, codes and IDs with a CSPRNG and compare secrets in constant time.', verify: 'Code review: no Math.random() for security values, and comparisons use a timing-safe function.' },
    ],
  },
  {
    id: 'audit',
    label: 'Destructive and audited actions',
    patterns: [
      /\baudit\b/, /\bdelete (the |an |my |a )?(account|user|project|workspace|data|organi[sz]ation)s?\b/, /\b(deactivate|suspend)\b/,
      /\bimpersonat(e|ion)\b/, /\bbulk (delete|update|edit)\b/, /\bretention\b/,
    ],
    checks: [
      { id: 'AUDIT-1', cwe: 'CWE-778', title: 'Log who did what, to which object and when, for every sensitive or destructive action.', verify: 'Test: performing the action writes an audit entry with actor, target, time and outcome.' },
      { id: 'AUDIT-2', cwe: null, title: 'Destructive actions need a confirmation step or a recoverable soft delete.', verify: 'Test: a deleted item can be restored within the retention window, or the action requires re-authentication.' },
    ],
  },
  {
    id: 'dependency',
    label: 'New or upgraded dependencies',
    patterns: [
      /\b(add|adding|upgrade|upgrading|bump|bumping)\b[^.\n]{0,40}\b(dependency|dependencies|library|package|sdk|plugin)\b/,
      /\b(npm|pip|yarn|pnpm) (install|add)\b/, /\bthird[- ]party (sdk|library|service|api)\b/,
    ],
    checks: [
      { id: 'DEP-1', cwe: 'CWE-1395', title: 'New or upgraded dependencies are pinned, come from the official registry and have no known critical vulnerabilities.', verify: 'Run npm audit, pip-audit or an OSV scan on the lockfile and attach the result.' },
      { id: 'DEP-2', cwe: 'CWE-1104', title: "Review the package's maintenance and install scripts before adding it.", verify: 'Note in the ticket: last release date, maintainers, and whether install scripts run.' },
    ],
  },
  {
    id: 'redirect',
    label: 'Redirects',
    patterns: [/\bredirect(s|ed|ing)?\b/, /\breturn ?url\b/, /\breturn_to\b/, /\bnext=/, /\bdeep links?\b/],
    checks: [
      { id: 'REDIR-1', cwe: 'CWE-601', title: 'Redirect only to relative paths or an allowlist of hosts.', verify: 'Test: ?next=https://evil.example and //evil.example are refused or replaced with the default page.' },
    ],
  },
];

export const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));
