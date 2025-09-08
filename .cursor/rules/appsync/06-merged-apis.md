Merged APIs

Combine multiple source APIs into a single merged API so teams ship independently but clients consume one graph.

Resolve conflicts with directives:

@canonical for precedence

@hidden to exclude from merge

@renamed(to: "...") to map names across sources

Merged APIs support subscriptions, multi‑auth, and cross‑account sharing.

Naming

Prefix types by bounded context if needed to avoid ambiguous merges (e.g., BillingInvoice, ContentInvoice).