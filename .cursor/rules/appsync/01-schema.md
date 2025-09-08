Schema design rules

Input types for every mutation. Use non‑null only when the backend guarantees it.

Pagination: either Relay‑style connections or { items, nextToken }. Be consistent.

Field ownership: expose server‑computed fields read‑only on the schema (e.g., version, timestamps).

Subscriptions: return shape must be a subset of the triggering mutation’s selection set.

Model filters and sort keys explicitly (e.g., byAuthor(author: String!, limit: Int, nextToken: String)), don’t rely on client‑side filtering.

Example
type Post {
id: ID!
title: String!
author: String
createdAt: AWSDateTime!
updatedAt: AWSDateTime!
version: Int!
}


type PostConnection { items: [Post!]!, nextToken: String }


type Query {
getPost(id: ID!): Post
listPosts(limit: Int, nextToken: String): PostConnection
postsByAuthor(author: String!, limit: Int, nextToken: String): PostConnection
}


input AddPostInput { id: ID!, title: String!, author: String }
input UpdatePostInput { id: ID!, title: String, author: String, version: Int! }


type Mutation {
addPost(input: AddPostInput!): Post!
updatePost(input: UpdatePostInput!): Post!
}


# Subscription selection ⊆ mutation selection
fragment PostFields on Post { id title author version }


type Subscription {
addedPost: Post @aws_subscribe(mutations: ["addPost"]) # request PostFields on client
}