Security & authorization

Pick a default auth mode: typically Cognito User Pools for end‑users or IAM for server/m2m.

Add additional modes only if required (API_KEY for dev/public read, OIDC for enterprise IdPs, Lambda for custom tokens).

Use schema directives to override at type/field level: @aws_cognito_user_pools, @aws_iam, @aws_api_key, @aws_oidc, @aws_lambda.

Enforce ownership/tenancy at the resolver (conditions on partition key + owner sub, or orgId checks) when directives aren’t enough.

Subscriptions are authorized at connection time; if needed, attach a resolver to the subscription field for a second check.

Patterns
# Default: IAM (example)


type Query {
getPost(id: ID!): Post # uses default IAM
listPublicPosts: [Post] @aws_api_key # public read (dev/demo)
}


type Post @aws_api_key @aws_iam { # mixed access per consumer
id: ID!
title: String!
author: String
restrictedContent: String @aws_iam
}

Resolver ownership check (sketch)

// in APPSYNC_JS resolver before write
import * as ddb from '@aws-appsync/utils/dynamodb'
export function request(ctx) {
const owner = ctx.identity?.sub
return ddb.update({
key: { id: ctx.args.input.id },
update: {
condition: { owner: { eq: owner }, version: { eq: ctx.args.input.version } },
// ... set expressions
}
})
}