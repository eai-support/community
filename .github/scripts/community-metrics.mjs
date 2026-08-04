const METRIC_IDS = [
  "first-human-response-median",
  "first-human-response-p90",
  "classification-time",
  "resolution-time",
  "backlog-age",
  "answer-rate",
  "unanswered-age",
  "duplicate-rate",
  "needs-information-rate",
  "reopen-rate",
  "documentation-conversion",
  "contributors",
  "discussion-reach",
];

export const metricDefinitions = Object.freeze({
  definition_version: "1.0.0",
  metrics: METRIC_IDS.map((metric_id) => ({ metric_id })),
});

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function parsedTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const millisecond = Number(fraction.padEnd(3, "0"));
  const parsed = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millisecond,
  );
  const date = new Date(parsed);
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second) &&
    date.getUTCMilliseconds() === millisecond
  )
    ? parsed
    : null;
}

function secondsBetween(start, end) {
  return Math.round((parsedTimestamp(end) - parsedTimestamp(start)) / 1000);
}

function emptyMetrics() {
  return Object.fromEntries(
    METRIC_IDS.map((metricId) => [
      metricId,
      { value: null, sample_size: 0, incomplete: true },
    ]),
  );
}

export function computeCommunityMetrics({
  definitionVersion,
  periodStart,
  periodEnd,
  events,
  extractionErrors = [],
}) {
  if (definitionVersion !== metricDefinitions.definition_version) {
    throw new Error("Metric definition version is unsupported");
  }
  const periodStartMs = parsedTimestamp(periodStart);
  const periodEndMs = parsedTimestamp(periodEnd);
  if (
    periodStartMs === null ||
    periodEndMs === null ||
    periodStartMs >= periodEndMs
  ) {
    throw new Error("Metric period must have a positive duration");
  }
  const validationErrors = [];
  for (const event of events) {
    const occurredAt = parsedTimestamp(event.occurred_at);
    if (occurredAt === null || occurredAt > periodEndMs) {
      validationErrors.push("invalid-event-timestamp");
    }
  }
  const eventsByItem = new Map();
  for (const event of events) {
    if (!eventsByItem.has(event.item)) eventsByItem.set(event.item, []);
    eventsByItem.get(event.item).push(event);
  }
  for (const itemEvents of eventsByItem.values()) {
    const openings = itemEvents.filter(({ event }) =>
      ["opened", "discussion_opened"].includes(event),
    );
    if (openings.length === 0) continue;
    const openedAt = Math.min(
      ...openings.map(({ occurred_at }) => parsedTimestamp(occurred_at)),
    );
    if (
      itemEvents.some(
        ({ event, occurred_at }) =>
          !["opened", "discussion_opened"].includes(event) &&
          parsedTimestamp(occurred_at) < openedAt,
      )
    ) {
      validationErrors.push("invalid-event-chronology");
    }
  }
  const allErrors = [...extractionErrors, ...validationErrors];
  if (allErrors.length > 0) {
    return {
      definition_version: definitionVersion,
      period_start: periodStart,
      period_end: periodEnd,
      period_status: "incomplete",
      incomplete_reason_classes: [...new Set(allErrors)].sort(),
      metrics: emptyMetrics(),
    };
  }

  const byItem = eventsByItem;

  const firstHumanResponse = [];
  const classificationTimes = [];
  const resolutionTimes = [];
  const backlogAges = [];
  const unansweredAges = [];
  let issueOpened = 0;
  let discussionOpened = 0;
  let answered = 0;
  let duplicates = 0;
  let needsInformation = 0;
  let reopened = 0;
  let candidates = 0;
  let publishedCandidates = 0;
  const contributors = new Set();
  const discussions = new Set();

  for (const [item, itemEvents] of byItem) {
    const ordered = [...itemEvents].sort((left, right) =>
      left.occurred_at.localeCompare(right.occurred_at),
    );
    const opened = ordered.find(({ event }) =>
      ["opened", "discussion_opened"].includes(event),
    );
    const openedMs = opened ? parsedTimestamp(opened.occurred_at) : null;
    const openedInPeriod =
      openedMs !== null && openedMs >= periodStartMs && openedMs < periodEndMs;
    const firstMaintainer = ordered.find(
      (candidate) =>
        candidate.event === "comment" &&
        candidate.actor_kind === "maintainer" &&
        openedMs !== null &&
        parsedTimestamp(candidate.occurred_at) >= openedMs,
    );
    if (openedInPeriod && firstMaintainer) {
      firstHumanResponse.push(secondsBetween(opened.occurred_at, firstMaintainer.occurred_at));
    }
    const classified = ordered.find(
      ({ event, occurred_at }) =>
        event === "classified" &&
        openedMs !== null &&
        parsedTimestamp(occurred_at) >= openedMs,
    );
    if (openedInPeriod && classified) {
      classificationTimes.push(secondsBetween(opened.occurred_at, classified.occurred_at));
    }
    const resolved = ordered.find(
      ({ event, occurred_at }) =>
        event === "resolved" &&
        openedMs !== null &&
        parsedTimestamp(occurred_at) >= openedMs,
    );
    if (openedInPeriod && resolved) {
      resolutionTimes.push(secondsBetween(opened.occurred_at, resolved.occurred_at));
    } else if (opened && ordered.some(({ event }) => event === "issue_active")) {
      backlogAges.push(secondsBetween(opened.occurred_at, periodEnd));
    }
    if (openedInPeriod && opened.event === "opened") issueOpened += 1;
    const discussionOpening = ordered.find(({ event }) => event === "discussion_opened");
    const isQaDiscussion = discussionOpening?.discussion_kind === "q-and-a";
    if (openedInPeriod && discussionOpening && isQaDiscussion) {
      discussionOpened += 1;
      const answerEvent = ordered.find(({ event }) => event === "answered");
      if (answerEvent) answered += 1;
    }
    if (ordered.some(({ event }) => event === "discussion_active")) {
      discussions.add(item);
    }
    if (
      isQaDiscussion &&
      ordered.some(({ event }) => event === "discussion_open") &&
      !ordered.some(({ event }) => event === "answered") &&
      opened
    ) {
      unansweredAges.push(secondsBetween(opened.occurred_at, periodEnd));
    }
    const inPeriod = ({ occurred_at }) => {
      const timestamp = parsedTimestamp(occurred_at);
      return timestamp >= periodStartMs && timestamp < periodEndMs;
    };
    const eligibleIssueCohort = openedInPeriod && opened?.event === "opened";
    if (
      eligibleIssueCohort &&
      ordered.some((event) => event.event === "duplicate" && inPeriod(event))
    ) {
      duplicates += 1;
    }
    if (
      eligibleIssueCohort &&
      ordered.some((event) => event.event === "needs_information" && inPeriod(event))
    ) {
      needsInformation += 1;
    }
    if (
      eligibleIssueCohort &&
      ordered.some((event) => event.event === "reopened" && inPeriod(event))
    ) {
      reopened += 1;
    }
    const isCandidate = ordered.some(
      (event) => event.event === "documentation_candidate" && inPeriod(event),
    );
    if (isCandidate) {
      candidates += 1;
    }
    if (
      isCandidate &&
      ordered.some((event) => event.event === "documentation_published" && inPeriod(event))
    ) {
      publishedCandidates += 1;
    }
    for (const event of ordered) {
      if (event.contributor_key && event.actor_kind !== "bot" && inPeriod(event)) {
        contributors.add(event.contributor_key);
      }
    }
  }

  const durationMetric = (values, reducer = (input) => percentile(input, 0.5)) => {
    const value = reducer(values);
    return { value, value_seconds: value, sample_size: values.length };
  };
  const rate = (numerator, denominator) => ({
    value: denominator === 0 ? null : numerator / denominator,
    sample_size: denominator,
  });

  return {
    definition_version: definitionVersion,
    period_start: periodStart,
    period_end: periodEnd,
    period_status: "complete",
    metrics: {
      "first-human-response-median": {
        ...durationMetric(firstHumanResponse),
        automation_excluded: true,
      },
      "first-human-response-p90": {
        ...durationMetric(firstHumanResponse, (values) => percentile(values, 0.9)),
        automation_excluded: true,
      },
      "classification-time": durationMetric(classificationTimes),
      "resolution-time": durationMetric(resolutionTimes),
      "backlog-age": durationMetric(backlogAges, (values) => percentile(values, 0.9)),
      "answer-rate": rate(answered, discussionOpened),
      "unanswered-age": durationMetric(unansweredAges, (values) => percentile(values, 0.9)),
      "duplicate-rate": rate(duplicates, issueOpened),
      "needs-information-rate": rate(needsInformation, issueOpened),
      "reopen-rate": rate(reopened, issueOpened),
      "documentation-conversion": rate(publishedCandidates, candidates),
      contributors: { value: contributors.size, sample_size: contributors.size },
      "discussion-reach": { value: discussions.size, sample_size: discussions.size },
    },
  };
}

export function sanitizeDigest(digest) {
  return Object.fromEntries(Object.entries({
    period_status: digest.period_status,
    definition_version: digest.definition_version,
    period_start: digest.period_start,
    period_end: digest.period_end,
    computed_at: digest.computed_at,
    incomplete_reason_classes: digest.incomplete_reason_classes ?? [],
    exclusions: digest.exclusions ?? [],
    metrics: digest.metrics,
  }).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)));
}
