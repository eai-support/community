# Channel routing and knowledge reuse

## Public Q&A

Help & Q&A is the answerable, public Discussion category for questions that can
produce reusable guidance. The form displays the restricted security and
authenticated support routes before it asks for text, and every participant
must affirm that prohibited sensitive content has been removed.

Questions about account-specific configuration, tenant information,
confidential diagnostics, contracts, entitlements, service incidents, or
vulnerabilities do not belong in Q&A. Moderators use the private route
appropriate to the topic and follow the sensitive-disclosure runbook if
restricted content has already been posted.

## Accepted answer to documentation

An accepted answer is a signal, not canonical documentation and not a delivery
promise. The intake workflow rereads the current Discussion, reconciles duplicate
or out-of-order events, and creates at most one customer-safe nomination marked
`eai-docs-candidate-v1`.

The nomination carries only:

- the public source URL;
- a customer-safe public topic;
- the reason `accepted-discussion-answer`; and
- the nomination timestamp.

A documentation owner reviews the public source before accepting it into
private work management. Draft notes, reviewer assignments, internal schedules,
and delivery references stay private. If the answer is later unaccepted, the
history is retained and the candidate returns to human review; automation does
not delete evidence or publish a correction by itself.

Canonical guidance is published only through the normal reviewed,
version-controlled documentation workflow. The public Discussion retains its
source link after publication. GitHub Wiki is not a canonical knowledge store.

The private workflow states are `identified`, `queued`, `drafting`, `published`,
and `rejected`. A documentation owner accepts the candidate, selects a
customer-facing documentation area, and reviews the draft through the normal
pull-request process. Publication records the canonical public URL and keeps the
original public source link. Rejection uses only a private disposition such as
duplicate, too specific, obsolete, or insufficient evidence; it does not delete
the source Discussion or imply a product decision.

## Failure and manual fallback

If automation is disabled or GitHub APIs are unavailable, maintainers can
moderate Q&A, mark answers, and record a documentation candidate manually using
the same minimum customer-safe fields. Public Q&A remains available unless a
separate abuse or privacy gate requires a time-bounded restriction.
