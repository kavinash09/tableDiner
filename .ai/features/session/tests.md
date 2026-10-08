# Session Tests

## Existing Tests
- **0 tests** exist for the Session feature.

## Missing Tests
- **Unit Tests**:
  - `TableSession.closeSession()`: Validate financial calculations and state transition logic.
  - `TableSession.calculateRunningSubtotal()`: Verify accurate summing of order items.
  - `AppUseCases.placeOrder()`: Verify that a session is properly auto-created with the correct `tenantId` and `businessDate`.
- **Integration Tests**:
  - Verify that multiple simultaneous orders on the same table do not create duplicate `OPEN` sessions.

