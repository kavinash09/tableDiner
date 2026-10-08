# Table Business Rules

1. **Restaurant Association**: Every table belongs to exactly one `Restaurant`.
2. **Unique Identity**: Each table is identified by a unique `qrCode`.
3. **Session Hosting**: A table hosts `Session` entities.
4. **Session Constraint**: A table can only have **one** `OPEN` session at any given time.
5. **Onboarding Limitations**: Tables are currently created only during tenant/restaurant provisioning. There is no API for a restaurant admin to add, remove, or modify tables dynamically.

