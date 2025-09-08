Testing & ops

Unit test APPSYNC_JS handlers as pure functions; mock ctx (args, identity, stash, prev).

Integration tests: run GraphQL ops against a stage; verify resolver side effects in DynamoDB.

Observability: emit structured logs from Lambdas; enable AppSync logs (field resolver timing) in non‑prod.

Console tools: use Events Pub/Sub editor to test channels, wildcards, and batch publishes.

Example test harness idea

const ctx = { args: { id: '1' } } as any
const req = request(ctx)
// assert on Dynamo request shape