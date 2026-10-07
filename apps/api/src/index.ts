import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import {
  PlaceOrderSchema,
  PaySchema,
  UpdateOrderStatusSchema,
  CreateRestaurantSchema,
  UpdateRestaurantSettingsSchema
} from '@tablediner/shared-validation';
import { processUpload } from './uploadService';

// Import Adapters
import { 
  PrismaTableRepository, 
  PrismaSessionRepository, 
  PrismaOrderRepository, 
  PrismaPaymentRepository,
  PrismaRestaurantRepository,
  PrismaMenuItemRepository
} from './adapters/secondary/db/PrismaRepositories';

// Import Core Use Cases
import { AppUseCases } from './core/use-cases/AppUseCases';

// Ensure uploads dir exists for local dev
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = Fastify({ logger: true });

// Dependency Injection Setup
const tableRepo = new PrismaTableRepository();
const sessionRepo = new PrismaSessionRepository();
const orderRepo = new PrismaOrderRepository();
const paymentRepo = new PrismaPaymentRepository();
const restaurantRepo = new PrismaRestaurantRepository();
const menuItemRepo = new PrismaMenuItemRepository();

const appUseCases = new AppUseCases(
  tableRepo,
  sessionRepo,
  orderRepo,
  paymentRepo,
  restaurantRepo,
  menuItemRepo
);

app.register(cors, {
  origin: '*', // For MVP/development, allow all origins
});

app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.register(staticPlugin, {
  root: uploadsDir,
  prefix: '/uploads/',
});

app.get('/health', async () => ({ status: 'ok' }));

// Fetch table details, current session, and full menu by QR code
app.get('/table/:qrCode', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  try {
    const data = await appUseCases.getTableDetails(qrCode);
    if (!data) return reply.status(404).send({ error: 'Table not found or invalid QR code.' });
    return data;
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
    const order = await appUseCases.placeOrder(qrCode, items);
    return { success: true, order };
  } catch (err: any) {
    app.log.error(err);
    return reply.status(err.message === 'Table not found.' ? 404 : 500).send({ error: err.message || 'Failed to place order.' });
  }
});

// --- BILLING & PAYMENTS ---
app.get('/table/:qrCode/bill', async (request, reply) => {
  const { qrCode } = request.params as { qrCode: string };
  try {
    const bill = await appUseCases.getBill(qrCode);
    return bill;
  } catch (err: any) {
    app.log.error(err);
    return reply.status(err.message === 'No active session found.' ? 404 : 500).send({ error: err.message || 'Failed to fetch bill.' });
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
    await appUseCases.payBill(qrCode, amount);
    return { success: true, message: 'Payment successful. Session closed.' };
  } catch (err: any) {
    app.log.error(err);
    return reply.status(err.message === 'No active session found.' ? 404 : 500).send({ error: err.message || 'Payment failed. Please try again.' });
  }
});

// --- KITCHEN DASHBOARD ROUTES ---
app.get('/kitchen/orders', async (request, reply) => {
  try {
    const orders = await appUseCases.getKitchenOrders();
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
    const order = await appUseCases.updateOrderStatus(orderId, status);
    return order;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to update order status.' });
  }
});

// --- PLATFORM ADMIN ROUTES ---
app.get('/admin/restaurants', async (request, reply) => {
  try {
    const tenants = await appUseCases.getPlatformTenants();
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
    const tenant = await appUseCases.createPlatformTenant(tenantName, restaurantName, tablesCount);
    return tenant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to create tenant.' });
  }
});

app.get('/restaurant/current', async (request, reply) => {
  try {
    const restaurant = await appUseCases.getCurrentRestaurant();
    return restaurant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch restaurant' });
  }
});

app.patch('/restaurant/:id/settings', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const parseResult = UpdateRestaurantSettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { theme, qrTemplate } = parseResult.data;
    const restaurant = await appUseCases.updateRestaurantSettings(id, theme, qrTemplate);
    return restaurant;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to update settings.' });
  }
});

app.post('/restaurant/:id/banner', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const bannerUrl = await processUpload(data);
    await appUseCases.updateRestaurantBanner(id, bannerUrl);
    
    return { success: true, bannerUrl };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to upload banner' });
  }
});

app.post('/menu-item/:id/image', async (request, reply) => {
  const { id } = request.params as { id: string };
  try {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const imageUrl = await processUpload(data);
    await appUseCases.updateMenuItemImage(id, imageUrl);
    
    return { success: true, imageUrl };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to upload image' });
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
