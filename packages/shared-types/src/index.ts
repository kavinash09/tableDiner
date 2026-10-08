// Base Models matching Prisma types
export interface Tenant {
  id: string;
  name: string;
  onboardingStatus: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Restaurant {
  id: string;
  tenantId: string;
  name: string;
  subscriptionTier: string;
  theme: string;
  qrTemplate: string;
  bannerUrl: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  name: string;
  qrCode: string;
  restaurantId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  restaurantId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  restaurantId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  status: 'ACTIVE' | 'CLOSED';
  totalAmount: number | null;
  restaurantId: string;
  tableId: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  status: 'RECEIVED' | 'PREPARING' | 'READY' | 'SERVED';
  sessionId: string;
  acceptedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  notes?: string | null;
  unitPrice: number;
  lineTotal: number;
  orderId: string;
  menuItemId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  providerId: string | null;
  method: string | null;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface HealthResponse {
  status: string;
}

export interface TableDetailsResponse {
  table: { id: string; name: string };
  restaurant: { id: string; name: string; theme: string; bannerUrl: string | null };
  session: Session | null;
  menu: {
    categories: (MenuCategory & { items: MenuItem[] })[];
    uncategorized: MenuItem[];
  };
}

export interface PlaceOrderResponse {
  success: boolean;
  order: Order & { items: OrderItem[] };
}

export interface BillResponse {
  sessionId: string;
  itemized: {
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }[];
  totalAmount: number;
}

export interface PayResponse {
  success: boolean;
  message: string;
}

export type KitchenOrdersResponse = (Order & {
  items: (OrderItem & { menuItem: MenuItem })[];
  session: Session & { table: Table };
})[];

export type UpdateOrderResponse = Order;

export type AdminRestaurantsResponse = (Tenant & {
  restaurants: (Restaurant & { tables: Table[] })[];
})[];

export type CreateRestaurantResponse = Tenant & {
  restaurants: (Restaurant & { tables: Table[] })[];
};

export interface ErrorResponse {
  error: string;
}
