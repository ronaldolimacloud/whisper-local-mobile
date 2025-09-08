Patterns for AI/LLM features

For token streaming, publish partial results to clients via Events or trigger a light mutation → subscription loop.

Store conversation state (messages, tool calls, partials) in DynamoDB; write via pipeline (validate → call model → persist → publish partials).

Keep events tiny: { id, step, token }. Emit a final COMPLETE with references to persisted artifacts.

Skeleton

// Pipeline fn pseudo
step1_validate()
step2_callModel_stream((chunk)=> publishEvent(`/default/sessions/${id}`, {token: chunk}))
step3_persist()
step4_publishFinal()