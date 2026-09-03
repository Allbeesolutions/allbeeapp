# ALLBEE AI v2 security boundary

`ai-chat-v2` accepts a server-generated system/context payload from the ALLBEE app. The function wraps that payload in an explicit untrusted-data boundary before sending it to the model. User messages cannot become `system` messages.

This is an application-layer guardrail inspired by the guardrail architecture reviewed in `suhasbhairav/ai-chief-of-staff`; it does not grant the model database/tool access.
