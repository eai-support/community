"use strict";

const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const WORKFLOW_BOT_LOGIN = "github-actions[bot]";

function isTrustedLifecycleMarkerAuthor(comment) {
  const association = String(
    comment?.authorAssociation ?? comment?.author_association ?? "",
  ).toUpperCase();
  const login = comment?.author?.login ?? comment?.user?.login;
  return (
    TRUSTED_ASSOCIATIONS.has(association) ||
    login === WORKFLOW_BOT_LOGIN
  );
}

function hasTrustedLifecycleMarker(comments, marker) {
  return comments.some(
    (comment) =>
      comment?.body?.includes(marker) &&
      isTrustedLifecycleMarkerAuthor(comment),
  );
}

module.exports = {
  hasTrustedLifecycleMarker,
  isTrustedLifecycleMarkerAuthor,
};
