import {
  computeCommunityMetrics,
  metricDefinitions,
  sanitizeDigest,
} from "./community-metrics.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isTrustedLifecycleMarkerAuthor } = require("./trusted-lifecycle-marker.cjs");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAINTAINER_ASSOCIATIONS = new Set(["MEMBER", "OWNER", "COLLABORATOR"]);
const DOC_CANDIDATE_MARKER = "eai-docs-candidate-v1";
const DOC_PUBLISHED_MARKER = "eai-docs-published-v1";

function actorKind(author, association) {
  if (author?.type === "Bot" || author?.__typename === "Bot") return "bot";
  return MAINTAINER_ASSOCIATIONS.has(association?.toUpperCase())
    ? "maintainer"
    : "user";
}

function inPeriod(value, periodStart, periodEnd) {
  const timestamp = Date.parse(value);
  return timestamp >= Date.parse(periodStart) && timestamp < Date.parse(periodEnd);
}

function bodyMarkerEvents({ item, body, occurredAt, author, association }) {
  if (!isTrustedLifecycleMarkerAuthor({ author, authorAssociation: association })) {
    return [];
  }
  const events = [];
  if (body?.includes(DOC_CANDIDATE_MARKER)) {
    events.push({
      item,
      event: "documentation_candidate",
      occurred_at: occurredAt,
      actor_kind: actorKind(author, association),
    });
  }
  if (body?.includes(DOC_PUBLISHED_MARKER)) {
    events.push({
      item,
      event: "documentation_published",
      occurred_at: occurredAt,
      actor_kind: actorKind(author, association),
    });
  }
  return events;
}

export function normalizeCommunityRecords(
  { issues = [], discussions = [] },
  { periodStart, periodEnd },
) {
  const events = [];
  for (const issue of issues) {
    const item = issue.node_id;
    events.push({
      item,
      event: "opened",
      occurred_at: issue.created_at,
      actor_kind: actorKind(issue.user, issue.author_association),
      contributor_key: inPeriod(issue.created_at, periodStart, periodEnd)
        ? issue.user?.login
        : undefined,
    });
    if (issue.state === "open") {
      events.push({
        item,
        event: "issue_active",
        occurred_at: periodEnd,
        actor_kind: "system",
      });
    }
    for (const comment of issue.comments ?? []) {
      const kind = actorKind(comment.user, comment.author_association);
      events.push({
        item,
        event: "comment",
        occurred_at: comment.created_at,
        actor_kind: kind,
        contributor_key:
          kind !== "bot" && inPeriod(comment.created_at, periodStart, periodEnd)
            ? comment.user?.login
            : undefined,
      });
      events.push(...bodyMarkerEvents({
        item,
        body: comment.body,
        occurredAt: comment.created_at,
        author: comment.user,
        association: comment.author_association,
      }));
    }
    for (const timelineEvent of issue.timeline ?? []) {
      const occurredAt = timelineEvent.created_at;
      if (!occurredAt) continue;
      if (
        timelineEvent.event === "labeled" &&
        /^kind\//.test(timelineEvent.label?.name ?? "")
      ) {
        events.push({ item, event: "classified", occurred_at: occurredAt, actor_kind: "maintainer" });
      }
      if (timelineEvent.event === "labeled" && timelineEvent.label?.name === "status/duplicate") {
        events.push({ item, event: "duplicate", occurred_at: occurredAt, actor_kind: "maintainer" });
      }
      if (timelineEvent.event === "labeled" && timelineEvent.label?.name === "status/needs-info") {
        events.push({
          item,
          event: "needs_information",
          occurred_at: occurredAt,
          actor_kind: "maintainer",
        });
      }
      if (timelineEvent.event === "closed") {
        events.push({ item, event: "resolved", occurred_at: occurredAt, actor_kind: "maintainer" });
      }
      if (timelineEvent.event === "reopened") {
        events.push({ item, event: "reopened", occurred_at: occurredAt, actor_kind: "maintainer" });
      }
    }
  }

  for (const discussion of discussions) {
    const item = discussion.id;
    const discussionKind = discussion.category?.isAnswerable ? "q-and-a" : "discussion";
    events.push({
      item,
      event: "discussion_opened",
      occurred_at: discussion.createdAt,
      actor_kind: actorKind(discussion.author),
      discussion_kind: discussionKind,
      contributor_key: inPeriod(discussion.createdAt, periodStart, periodEnd)
        ? discussion.author?.login
        : undefined,
    });
    if (!discussion.closed) {
      events.push({
        item,
        event: "discussion_open",
        occurred_at: periodEnd,
        actor_kind: "system",
      });
    }
    if (inPeriod(discussion.updatedAt, periodStart, periodEnd)) {
      events.push({
        item,
        event: "discussion_active",
        occurred_at: discussion.updatedAt,
        actor_kind: "system",
      });
    }
    if (discussion.isAnswered && discussion.answerChosenAt) {
      events.push({
        item,
        event: "answered",
        occurred_at: discussion.answerChosenAt,
        actor_kind: "maintainer",
      });
    }
    for (const comment of discussion.comments ?? []) {
      const kind = actorKind(comment.author, comment.authorAssociation);
      events.push({
        item,
        event: "comment",
        occurred_at: comment.createdAt,
        actor_kind: kind,
        contributor_key:
          kind !== "bot" && inPeriod(comment.createdAt, periodStart, periodEnd)
            ? comment.author?.login
            : undefined,
      });
      events.push(...bodyMarkerEvents({
        item,
        body: comment.body,
        occurredAt: comment.createdAt,
        author: comment.author,
        association: comment.authorAssociation,
      }));
    }
  }
  return events;
}

const DISCUSSIONS_QUERY = `
  query CommunityDiscussions($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      discussions(first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          id createdAt updatedAt closed isAnswered answerChosenAt
          author { __typename login }
          category { isAnswerable }
          comments(first: 100) {
            nodes {
              body createdAt authorAssociation
              author { __typename login }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;
const DISCUSSION_COMMENTS_QUERY = `
  query DiscussionComments($id: ID!, $cursor: String!) {
    node(id: $id) {
      ... on Discussion {
        comments(first: 100, after: $cursor) {
          nodes {
            body createdAt authorAssociation
            author { __typename login }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

async function collectIssueRecords(github, owner, repository, periodStart) {
  const [recent, open] = await Promise.all([
    github.paginate(github.rest.issues.listForRepo, {
      owner,
      repo: repository,
      state: "all",
      since: periodStart,
      per_page: 100,
    }),
    github.paginate(github.rest.issues.listForRepo, {
      owner,
      repo: repository,
      state: "open",
      per_page: 100,
    }),
  ]);
  const issues = new Map(
    [...recent, ...open]
      .filter((issue) => !issue.pull_request)
      .map((issue) => [issue.number, issue]),
  );
  const records = [];
  for (const issue of issues.values()) {
    const [comments, timeline] = await Promise.all([
      github.paginate(github.rest.issues.listComments, {
        owner,
        repo: repository,
        issue_number: issue.number,
        per_page: 100,
      }),
      github.paginate(github.rest.issues.listEventsForTimeline, {
        owner,
        repo: repository,
        issue_number: issue.number,
        per_page: 100,
      }),
    ]);
    records.push({ ...issue, comments, timeline });
  }
  return records;
}

async function collectDiscussionRecords(github, owner, repository) {
  const discussions = [];
  let cursor = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await github.graphql(DISCUSSIONS_QUERY, {
      owner,
      name: repository,
      cursor,
    });
    const connection = response.repository.discussions;
    for (const discussion of connection.nodes) {
      const comments = [...discussion.comments.nodes];
      let commentPage = discussion.comments.pageInfo;
      let commentPages = 1;
      while (commentPage.hasNextPage && commentPages < 10) {
        const more = await github.graphql(DISCUSSION_COMMENTS_QUERY, {
          id: discussion.id,
          cursor: commentPage.endCursor,
        });
        comments.push(...more.node.comments.nodes);
        commentPage = more.node.comments.pageInfo;
        commentPages += 1;
      }
      if (commentPage.hasNextPage) {
        throw new Error("Discussion comment extraction exceeded the bounded 1000-item window");
      }
      discussions.push({ ...discussion, comments });
    }
    if (!connection.pageInfo.hasNextPage) return discussions;
    cursor = connection.pageInfo.endCursor;
  }
  throw new Error("Discussion extraction exceeded the bounded 1000-item window");
}

export async function buildCommunityDigest({
  github,
  owner,
  repository,
  now = new Date(),
  records,
}) {
  const periodEnd = new Date(now);
  const periodStart = new Date(periodEnd.getTime() - WEEK_MS);
  const extractionErrors = [];
  let sourceRecords = records;
  if (!sourceRecords) {
    const [issueResult, discussionResult] = await Promise.allSettled([
      collectIssueRecords(github, owner, repository, periodStart.toISOString()),
      collectDiscussionRecords(github, owner, repository),
    ]);
    sourceRecords = {
      issues: issueResult.status === "fulfilled" ? issueResult.value : [],
      discussions: discussionResult.status === "fulfilled" ? discussionResult.value : [],
    };
    if (issueResult.status === "rejected") extractionErrors.push("issues-extraction");
    if (discussionResult.status === "rejected") extractionErrors.push("discussions-extraction");
  }
  const events = normalizeCommunityRecords(sourceRecords, {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });
  const digest = computeCommunityMetrics({
    definitionVersion: metricDefinitions.definition_version,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    events,
    extractionErrors,
  });
  return sanitizeDigest({
    ...digest,
    computed_at: periodEnd.toISOString(),
    exclusions: [
      "automation-actors",
      "security-report-content",
      "contractual-case-content",
      "raw-bodies",
    ],
  });
}
