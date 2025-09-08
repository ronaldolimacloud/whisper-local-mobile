Quick decisions (keep this short in Cursor popups)

Real‑time tied to mutations on the graph? → GraphQL Subscriptions.

Arbitrary pub/sub (presence, typing, device telemetry, AI tokens)? → Events API.

Multiple domain teams; single client endpoint? → Merged API.

Auth: Cognito (end users) · IAM (server/m2m) · API Key (public/dev) · OIDC (enterprise) · Lambda (custom).

Resolver: Unit for 1 op; Pipeline for composed logic and cross‑datasource.

