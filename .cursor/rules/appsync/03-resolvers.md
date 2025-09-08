APPSYNC_JS resolvers

Unit resolver for single op; Pipeline resolver for composed logic. Share state via ctx.stash; prior output in ctx.prev.result.

Use @aws-appsync/utils helpers: dynamodb, util, runtime.

Prefer projection (only needed attributes) and conditional writes.

Use util.error() for hard fail; util.appendError() for partials; runtime.earlyReturn() to short‑circuit a pipeline.

Unit DDB get

// resolvers/Query.getPost.ts
import * as ddb from '@aws-appsync/utils/dynamodb'
export const request = (ctx) => ddb.get({ key: { id: ctx.args.id } })
export const response = (ctx) => ctx.result

Unit DDB put (create)
// resolvers/Mutation.addPost.ts
import * as ddb from '@aws-appsync/utils/dynamodb'
export function request(ctx) {
const now = new Date().toISOString()
const item = { ...ctx.args.input, createdAt: now, updatedAt: now, version: 1 }
return ddb.put({ item, condition: { attribute_not_exists: 'id' } })
}
export const response = (ctx) => ctx.result


Pipeline shell

// resolvers/Mutation.publishWithChecks.ts
import { util, runtime } from '@aws-appsync/utils'
export function request(ctx){ ctx.stash.startedAt = util.time.nowISO8601(); return {} }
export function response(ctx){ return ctx.prev.result }

