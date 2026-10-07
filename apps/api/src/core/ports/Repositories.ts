import type { 
  Table, 
  Restaurant, 
  Session, 
  Order, 
  Tenant, 
  MenuItem, 
  MenuCategory,
  OrderItem
} from '@tablediner/shared-types';

export interface ITableRepository {
  findByQrCode(qrCode: string): Promise<any>;
}

export interface ISessionRepository {
  createActiveSession(restaurantId: string, tableId: string): Promise<Session>;
  updateSessionStatus(sessionId: string, status: 'CLOSED'): Promise<Session>;
}

export interface IOrderRepository {
  createOrder(sessionId: string, items: { menuItemId: string; quantity: number; notes?: string }[]): Promise<Order>;
  getActiveOrders(): Promise<any[]>;
  updateOrderStatus(orderId: string, status: string): Promise<Order>;
}

export interface IPaymentRepository {
  processCheckout(sessionId: string, amount: number): Promise<void>;
}

export interface IRestaurantRepository {
  getAllTenantsWithRestaurants(): Promise<any[]>;
  createTenantAndRestaurant(tenantName: string, restaurantName: string, tablesCount: number): Promise<any>;
  getFirstRestaurant(): Promise<any>;
  updateSettings(id: string, theme: string, qrTemplate: string): Promise<Restaurant>;
  updateBanner(id: string, bannerUrl: string): Promise<void>;
}

export interface IMenuItemRepository {
  updateImage(id: string, imageUrl: string): Promise<void>;
}
