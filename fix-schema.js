const fs = require('fs');
let schema = fs.readFileSync('packages/db/prisma/schema.prisma', 'utf8');

// 1. Tenant additions
schema = schema.replace(
  '  createdAt DateTime @default(now())',
  '  onboardingStatus String @default("ONBOARDING")\n  isActive Boolean @default(true)\n  deletedAt DateTime?\n  createdAt DateTime @default(now())'
);

// 2. Restaurant additions
schema = schema.replace(
  /  createdAt DateTime @default\(now\)\)(?=[^]*model Table)/,
  '  isActive Boolean @default(true)\n  deletedAt DateTime?\n  createdAt DateTime @default(now())'
);
// Above regex is tricky. Let's do it safer.

