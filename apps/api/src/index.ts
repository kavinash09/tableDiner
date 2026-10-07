import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from '@tablediner/db';
import {
  PlaceOrderSchema,
  PaySchema,
  UpdateOrderStatusSchema,
  CreateRestaurantSchema
} from '@tablediner/shared-validation';

const app = Fastify({ logger: true });

app.register(cors, {
  origin: '*', // For MVP/development, allow all origins
});

app.get('/health', async () => ({ status: 'ok' }));

// Fetch table details, current session, and full menu by QR code
app.get('/table/:qrCode', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  try {
    const table = await prisma.table.findUnique({
      where: { qrCode },
      include: {
        restaurant: {
          include: {
            menuCategories: { include: { items: true } },
            menuItems: { where: { categoryId: null } },
          },
        },
        sessions: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    if (!table) {
      return reply.status(404).send({ error: 'Table not found or invalid QR code.' });
    }

    return {
      table: { id: table.id, name: table.name },
      restaurant: { id: table.restaurant.id, name: table.restaurant.name },
      session: table.sessions[0] || null,
      menu: {
        categories: table.restaurant.menuCategories,
        uncategorized: table.restaurant.menuItems,
      },
    };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch table data.' });
  }
});

// Place an order for a table
app.post('/table/:qrCode/order', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  const parsed = PlaceOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { items } = parsed.data;

  try {
    const table = await prisma.table.findUnique({
      where: { qrCode },
      include: { sessions: { where: { status: 'ACTIVE' }, take: 1 } },
    });

    if (!table) return reply.status(404).send({ error: 'Table not found.' });

    // Get or auto-create active session
    let session = table.sessions[0];
    if (!session) {
      session = await prisma.session.create({
        data: { status: 'ACTIVE', restaurantId: table.restaurantId, tableId: table.id },
      });
    }

    const order = await prisma.order.create({
      data: {
        sessionId: session.id,
        status: 'RECEIVED',
        items: {
          create: items.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        },
      },
      include: { items: true },
    });

    return { success: true, order };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to place order.' });
  }
});

// --- BILLING & PAYMENTS ---
app.get('/table/:qrCode/bill', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  try {
    const table = await prisma.table.findUnique({
      where: { qrCode },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            orders: { include: { items: { include: { menuItem: true } } } },
          },
        },
      },
    });

    if (!table || table.sessions.length === 0) {
      return reply.status(404).send({ error: 'No active session found.' });
    }

    const session = table.sessions[0];
    let totalAmount = 0;
    const itemized: { name: string; quantity: number; price: number; lineTotal: number }[] = [];

    for (const order of session.orders) {
      for (const item of order.items) {
        const lineTotal = item.menuItem.price * item.quantity;
        totalAmount += lineTotal;
        itemized.push({ name: item.menuItem.name, quantity: item.quantity, price: item.menuItem.price, lineTotal });
      }
    }

    return { sessionId: session.id, itemized, totalAmount };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch bill.' });
  }
});

app.post('/table/:qrCode/pay', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  const parsed = PaySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { amount } = parsed.data;

  try {
    const table = await prisma.table.findUnique({
      where: { qrCode },
      include: { sessions: { where: { status: 'ACTIVE' }, take: 1 } },
    });

    if (!table || table.sessions.length === 0) {
      return reply.status(404).send({ error: 'No active session found.' });
    }

    const session = table.sessions[0];

    await prisma.$transaction([
      prisma.payment.create({ data: { sessionId: session.id, status: 'COMPLETED', amount } }),
      prisma.session.update({ where: { id: session.id }, data: { status: 'CLOSED' } }),
    ]);

    return { success: true, message: 'Payment successful. Session closed.' };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Payment failed. Please try again.' });
  }
});

// --- KITCHEN DASHBOARD ROUTES ---
app.get('/kitchen/orders', async (request, reply) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] } },
      include: {
        items: { include: { menuItem: true } },
        session: { include: { table: true } },
      },
      orderBy: { id: 'asc' },
    });
    return orders;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch orders.' });
  }
});

app.patch('/kitchen/orders/:orderId', async (request, reply) => {
  const { orderId } = request.params as { orderId: string };
  const parsed = UpdateOrderStatusSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { status } = parsed.data;

  try {
    const order = await prisma.order.update({ where: { id: orderId }, data: { status } });
    return order;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to update order status.' });
  }
});

// --- PLATFORM ADMIN ROUTES ---
app.get('/admin/restaurants', async (request, reply) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: { restaurants: { include: { tables: true } } },
    });
    return tenants;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch tenants.' });
  }
});

app.post('/admin/restaurants', async (request, reply) => {
  const parsed = CreateRestaurantSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { tenantName, restaurantName, tablesCount } = parsed.data;

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        restaurants: {
          create: {
            name: restaurantName,
            tables: {
              create: Array.from({ length: tablesCount }).map((_, i) => ({ name: `Table ${i + 1}` })),
            },
          },
        },
      },
      include: { restaurants: { include: { tables: true } } },
    });
    return tenant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to create tenant.' });
  }
});

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    app.log.info('Server listening on port 3001');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
