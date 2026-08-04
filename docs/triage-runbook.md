# Public triage runbook

## Intake

Reread the current GitHub object. Event payloads are hints, not the source of
truth. Confirm the repository, form or category, privacy acknowledgement, and
customer-safe content before classification.

Apply one approved `kind/*` label and the minimum public lifecycle label. Keep
Product/Component, Affected Version, Deployment Mode, and Customer Impact as
Issue Form answers. Do not create organization Issue types or fields.

## Route and notify

Resolve the customer-facing component and route through the ownership matrix in
`ops/github/routes.yaml`. The protected launch input supplies different primary
and backup principals, opaque notification destinations, and escalation
windows. Notify the primary with only the public URL, customer-safe summary,
route key, and requested action; use the backup after the approved timeout.

Never expose either principal, the destination, a private repository, a private
Project, or contractual metadata in the public thread or shared evidence.

## Needs information

Use the marked request reply so the timer starts from the most recent qualifying
maintainer request. Reporter activity after that request cancels pending ageing.
Post at most one marked reminder after seven days.

Only a maintainer-confirmed action may close between days 21 and 30. Before
closure, confirm the item is not a confirmed bug, security matter, or active
contractual case. Items older than 30 days return to manual review; automation
does not close them. Always provide a reopen path.

## Duplicate and no-reproduction decisions

Link only a safe public canonical thread. A duplicate link never points to
private work. Mark `status/no-repro` only after reasonable public-safe attempts
and keep the reopen path. Age alone never closes a confirmed defect.

## Failure

If classification, notification, or optional private linkage fails, leave
public intake available, record an opaque result class, and route to human
triage. Do not retry permission or schema failures blindly and do not print
uncontrolled bodies.
