# Public support taxonomy

The public taxonomy is deliberately small and non-overlapping.

## Issue Form answers

Product/Component, Affected Version, Deployment Mode, and Customer Impact are
structured answers rendered into the public Issue body. Customer Impact
describes observable effect; it is not contractual severity or internal
priority.

## Public labels

Kind labels identify the intake form: `kind/bug`, `kind/documentation`, and
`kind/accessibility`.

Lifecycle labels identify the public state: `status/needs-triage`,
`status/needs-info`, `status/confirmed`, `status/planned`, `status/duplicate`,
and `status/no-repro`.

A concept appears in only one public mechanism. The initial launch creates or
modifies no organization Issue type or Issue field.

## Private-only work fields

Priority, Effort, Target Date, Contractual Tier, Internal Owner, Root-Cause
Category, and Private Delivery Link exist only in approved private work
management. They are never public labels, Issue Form answers, organization
fields, comments, workflow logs, or evidence.

## Operator views and search fallbacks

All views are scoped to `eai-support/community`. The declarative definitions and
exact fallback queries are in `ops/github/taxonomy.yaml`:

- Needs Triage
- Awaiting Customer
- Awaiting Maintainer
- Confirmed Unassigned Bugs
- Old Unanswered Q&A
- Duplicate Candidates

If repository saved views are unavailable or change, operators use the
documented GitHub search query. Preview view behavior is never required for a
core intake or triage journey.

## Ownership routing

`ops/github/routes.yaml` expands every supported customer-facing component
across all seven routes. Each route references one of seven accountable role
slots and requires different primary and backup principals, least privilege,
primary-then-backup notification, and an approved escalation window supplied
only through protected launch input.
