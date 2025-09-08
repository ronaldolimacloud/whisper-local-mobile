GraphQL Subscriptions

Wire subscriptions to mutations with @aws_subscribe.

Selection set rule: the fields you subscribe to must be a subset of the mutation’s response selection.

Use subscription arguments to server‑filter events (arguments are meaningful; null means “is null”, not “ignore”).

Keep payloads small; send identifiers and let clients fetch details if needed.

Example

subscription OnAddedPost { addedPost { id title version } } # subset
mutation AddPost($input: AddPostInput!) {
addPost(input: $input) { id title version }
}

Client tips

Auto‑reconnect with backoff; de‑dupe by id + version.

Handle out‑of‑order events (persist last seen version).
