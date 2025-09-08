Foundations & principles

Treat schema as a contract; evolve additively (add fields/types; avoid breaking changes).

Keep Query/Mutation/Subscription roots small; push domain logic into typed models and resolvers.

Use DynamoDB patterns via @aws-appsync/utils/dynamodb helpers; prefer conditional writes for correctness.

Minimize N+1: do aggregation in pipeline functions or purpose‑built queries.

Real‑time UX: small payloads (< ~250 KB), idempotent client handlers, exponential backoff on reconnect.

Scaffolds

schema { query: Query, mutation: Mutation, subscription: Subscription }


"""Domain model example"""
type Post { id: ID!, title: String!, author: String, version: Int! }


input AddPostInput { id: ID!, title: String!, author: String }


type Query { getPost(id: ID!): Post }


type Mutation { addPost(input: AddPostInput!): Post! }


type Subscription {
addedPost: Post @aws_subscribe(mutations: ["addPost"]) # fields ⊆ mutation selection
}