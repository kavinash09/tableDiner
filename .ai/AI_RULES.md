# AI CONSTITUTION

1. **MANDATORY CHECKPOINT**: YOU MUST EXECUTE PHASE 3 OF `RETRIEVAL_GUIDE.md` AT THE END OF EVERY TASK. NEVER LEAVE STATE FILES STALE.
2. SEARCH BEFORE CODING (DO NOT IGNORE HIDDEN DIRS LIKE `.ai`).
3. NO ARCHITECTURE CHANGES WITHOUT EXPLICIT USER APPROVAL.
4. NO NEW DEPENDENCIES WITHOUT EXPLICIT USER APPROVAL.
5. FOLLOW EXISTING PATTERNS & KEEP IT BORING.
6. MINIMAL CHANGE PRINCIPLE (Don't rewrite unrelated code).
7. PRESERVE CONTRACTS BETWEEN API AND UI.
8. UPDATE TESTS & DOCS FOR ANY BEHAVIOR CHANGES.
9. NO SILENT BUSINESS ASSUMPTIONS (Ask the user if unsure).
10. SQLITE + PRISMA ARE THE ABSOLUTE SOURCE OF TRUTH.
11. IMPLEMENT ONLY MVP SCOPE (Avoid feature creep).
12. **CURRENCY RULE**: All prices and amounts MUST be formatted and handled in Rupees (₹).
13. **MOBILE-FIRST UI**: All frontend apps (especially customer-web and restaurant-admin) MUST be designed mobile-first to ensure a flawless experience across both phones and desktop browsers.
14. **MANDATORY UNIT TESTING**: Application quality is non-negotiable. Every core business logic change or new use case MUST be accompanied by unit tests. If no testing framework exists, you must introduce one (e.g. vitest) and write tests before declaring a feature complete.
