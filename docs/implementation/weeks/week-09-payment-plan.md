# Week 09 — Payment Plan

## Outcome
Separate what the customer is expected to pay from what AC Travel actually received.

## Dependencies
Trip foundation and stable existing `payments` traceability.

## Primary work
- `payment_obligations` for deposit/installment/final/fee/adjustment;
- `payment_allocations` between actual Payments and obligations;
- balances/due/overdue states per Trip and currency;
- Finance verification/allocation UX;
- due/overdue Tasks/notifications.

## Required context
Volume I Finance rules; Volume II Finance workspace/portal; Volume III Finance model. Preserve existing `payments` as actual movements.

## Suggested Changes
1. `payment-obligation-foundation`
2. `payment-allocation-core`
3. `finance-balance-workspace`

## Completion gate
Partial, excess, and short payments are representable without corrupting expected amount; balances derive from obligations minus confirmed allocations; cross-currency obligations are not silently converted.
