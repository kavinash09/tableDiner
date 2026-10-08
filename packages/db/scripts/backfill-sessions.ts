import { prisma } from '../index';

export interface BackfillResult {
  scanned: number;
  repaired: number;
  errors: number;
}

/**
 * Idempotent, safe backfill function to recover missing closedAt timestamps
 * and financial snapshot totals on historical closed sessions.
 */
export async function backfillHistoricalSessions(): Promise<BackfillResult> {
  const brokenSessions = await prisma.session.findMany({
    where: {
      status: { not: 'OPEN' },
      OR: [
        { closedAt: null },
        { totalAmount: 0 },
        { totalAmount: null }
      ]
    },
    include: {
      orders: {
        include: { items: true }
      },
      payments: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  let repaired = 0;
  let errors = 0;

  for (const session of brokenSessions) {
    try {
      // 1. Recover closedAt timestamp: prefer latest completed payment createdAt, fallback to session.updatedAt
      const latestPayment = session.payments[0];
      const recoveredClosedAt = session.closedAt || latestPayment?.createdAt || session.updatedAt;

      // 2. Recover subtotal by summing non-cancelled order line totals
      const subtotal = session.orders
        .filter(o => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .flatMap(o => o.items)
        .reduce((sum, item) => sum + item.lineTotal, 0);

      // 3. Recover total amount: prefer payment amount, fallback to subtotal
      const recoveredTotal = (session.totalAmount && session.totalAmount > 0)
        ? session.totalAmount
        : (latestPayment?.amount || subtotal);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          closedAt: recoveredClosedAt,
          subtotal: session.subtotal && session.subtotal > 0 ? session.subtotal : subtotal,
          totalAmount: recoveredTotal
        }
      });

      repaired++;
    } catch (err) {
      console.error(`Failed to repair session ${session.id}:`, err);
      errors++;
    }
  }

  return {
    scanned: brokenSessions.length,
    repaired,
    errors
  };
}

// Allow standalone execution: npx tsx scripts/backfill-sessions.ts
if (require.main === module) {
  backfillHistoricalSessions()
    .then(result => {
      console.log('✅ Backfill completed:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Backfill failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

