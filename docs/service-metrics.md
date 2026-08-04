# Community service metrics

Definition version: `1.0.0`  
Owner role: Community  
Default classification: internal aggregate

Metrics use public event timestamps and the minimized automation action ledger.
They exclude vulnerability reports, private support, contractual cases,
uncontrolled bodies, confidential diagnostics, and private work metadata. Raw
actor timelines are not published or retained in the repository.

## Definitions

| Metric | Definition |
| --- | --- |
| First-human-response median | Median seconds from public item creation to the first qualifying maintainer response; bot and automation comments excluded |
| First-human-response p90 | Nearest-rank 90th percentile of the same eligible durations |
| Classification time | Seconds from creation to the first approved public classification |
| Resolution time | Seconds from creation to customer-safe public resolution |
| Backlog age | p90 age of open eligible items at the exclusive period end |
| Answer rate | Answered Help & Q&A Discussions divided by eligible Q&A Discussions |
| Unanswered age | p90 age of open unanswered eligible Q&A Discussions |
| Duplicate rate | Public Issues classified duplicate divided by eligible opened Issues |
| Needs-information rate | Public Issues entering `status/needs-info` divided by eligible opened Issues |
| Reopen rate | Reopened eligible Issues divided by eligible opened Issues |
| Documentation conversion | Published canonical documentation outcomes divided by eligible knowledge candidates |
| Contributors | Count of distinct non-bot public contributors in the period |
| Discussion reach | Count of eligible public Discussions active in the period |

Every result includes the definition version, inclusive start, exclusive end,
sample size, exclusions, and computation time. A definition change increments
the semantic version; incompatible versions are never silently combined.

## Human response

Only a comment by a current maintainer role qualifies. The identifiable bot
acknowledgement and all automation comments set `actor_kind=bot` and
`automation_excluded=true`. Reporter comments and reactions do not become a
maintainer response.

## Incomplete periods

Pagination gaps, permission failure, schema drift, rate-limit exhaustion, or an
unavailable source makes the whole affected period `incomplete`. Missing values
are `null`, never zero. Operators retry extraction or annotate the service
review; they do not compare incomplete and complete periods as if equivalent.

## Privacy, retention, and publication

The weekly workflow writes only a minimized aggregate to its temporary runner
directory and sends it through the approved protected environment. It uploads
no artifact and logs no metric body, user-authored content, actor identity,
security count, contract attribute, or private destination.

Raw API responses live only in process memory. The approved private reporting
store applies the owner-approved retention window. Publication requires a
separate privacy and commitment review and contains aggregates only.
