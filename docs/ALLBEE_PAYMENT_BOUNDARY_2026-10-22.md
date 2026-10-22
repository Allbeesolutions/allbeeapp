# AllBee payment-provider isolation — binding owner directive

**AllBee is an independent product. It must NOT import, call, share credentials with, depend on, or be routed through HajiPay.** This includes checkout APIs, webhook handlers, databases, SDKs, callback URLs, settlement records, shared secrets, payment events, or payment administration. HajiPay belongs to a separate platform and should remain untouched when working on AllBee.

If AllBee requires customer payments or payment-later products, use an independent provider selected specifically for AllBee after provider onboarding and legal/compliance review. No provider is currently approved in this work session. Do not invent gateway credentials, merchant IDs, live methods, costs, or endpoints.

Before a payment implementation: agree on provider choice, payment method/region and eligibility, financial settlement entity, refund/chargeback flows, webhook verification, idempotency, PCI exposure and ownership. Use a dedicated AllBee environment and migration. Preserve existing internal accounting/finance functionality; internal accounting is not a payment gateway.

Audit at 22 October 2026: no HajiPay SDK, endpoint, import or gateway integration was found in AllBee app source or SQL. Future merges should not introduce one.
