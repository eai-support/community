# Sensitive disclosure response

Use this runbook when credentials, personal or customer data, tenant
identifiers, confidential diagnostics, private URLs, contractual material, or
vulnerability details appear in a public Issue, Discussion, comment, workflow
log, release, or artifact.

## 1. Stop routine handling

- Do not quote, copy, label, summarize, or forward the sensitive value.
- Pause general triage and automation for the affected item.
- Record only the public object reference, detection time, reason class, and an
  opaque incident evidence key.
- Move communication to the approved Security, Privacy, or authenticated
  Support boundary.

Editing, hiding, locking, transferring, or deleting GitHub content does not
prove that confidentiality has been restored.

## 2. Contain

- If a credential may be exposed, have its owner revoke or rotate it through
  the authoritative secret system.
- Remove public Actions artifacts, logs, caches, releases, or generated pages
  that repeat the disclosure, without destroying unrelated public history.
- Apply a temporary interaction limit only when ongoing exposure or abuse
  requires it; record an expiry and reviewer.
- Prevent bots, digests, notifications, and metrics jobs from ingesting the
  sensitive body.

## 3. Request GitHub removal

Use GitHub's documented sensitive-data removal path with an authorized
organization administrator. Preserve the minimum audit evidence needed to
verify the request; do not reproduce the content in a support ticket or shared
artifact. Where history rewriting is necessary, obtain Security and repository
owner approval and coordinate affected clones and forks.

## 4. Open the private response

Open the authorized internal incident, privacy, security, or customer-support
path using only its opaque reference in the moderation log. Restrict access to
the minimum roles. Vulnerability material stays in GitHub private vulnerability
reporting or the security-owned system and never enters community automation.

## 5. Public communication

Leave only an approved, customer-safe notice stating that sensitive information
was removed and directing the reporter to the correct private route. Do not
name a customer, tenant, credential, private system, recipient, internal owner,
or technical vulnerability detail. A public notice does not confirm exploit
validity or promise remediation timing.

## 6. Verify and learn

- Confirm credential rotation or other containment where relevant.
- Verify the sensitive value is absent from current public content, GitHub
  search, Actions output, artifacts, generated evidence, and automation queues.
- Test that primary and backup private notifications were received.
- Record root-learning privately without copying the disclosed value.
- Review forms, warnings, saved replies, permissions, and automation filters.
- Obtain independent closure review from Security or Privacy.

Retain only sanitized public history and the minimum private audit record under
the approved retention policy.
