## Public customer outcome

Describe the customer-safe outcome and why this change belongs in the public
GitHub front door.

## Scope

- [ ] I identified every affected route, policy, form, workflow, permission,
      repository setting, and evidence contract.
- [ ] I preserved the public-data boundary and included no credentials,
      customer or tenant data, confidential diagnostics, private URL, private
      work reference, vulnerability detail, or contract attribute.
- [ ] I made no organization Issue type or Issue field mutation.

## Validation

- [ ] Policy, form-schema, link, route-parity, public-boundary, and
      workflow-permission checks pass where applicable.
- [ ] External-contributor execution is read-only, receives no secrets, and
      requires maintainer approval.
- [ ] Any Action reference is an immutable commit recorded in the pin registry.
- [ ] Accessibility and logged-out behavior were reviewed.

## Approval and rollback

- [ ] Accountable role, Security, Support, Documentation, Brand, and Legal
      reviews are identified where applicable.
- [ ] The change has a non-destructive rollback and manual-operation path.
- [ ] Launch, canary, activation, or promotion evidence is updated without
      principal, endpoint, token, or private topology values.
