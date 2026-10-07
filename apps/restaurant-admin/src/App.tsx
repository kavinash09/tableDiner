import { useEffect, useState } from 'react';
import type { KitchenOrdersResponse } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function App() {
  const [orders, setOrders] = useState<KitchenOrdersResponse>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = () => {
    fetch(`${API_URL}/kitchen/orders`)
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => setError(err.message));
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = (orderId: string, status: string) => {
    fetch(`${API_URL}/kitchen/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(() => fetchOrders());
  };

  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>👨‍🍳 Kitchen Dashboard</h1>
      <p style={{ color: '#666' }}>Live updating every 5 seconds...</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '30px' }}>
        {['RECEIVED', 'PREPARING', 'READY'].map(column => (
          <div key={column} style={{ flex: '1 1 300px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>{column}</h3>

            {orders.filter(o => o.status === column).map(order => (
              <div key={order.id} style={{ background: 'white', padding: '15px', marginBottom: '10px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <strong>{order.session?.table?.name || 'Unknown Table'}</strong> - #{order.id.slice(-4)}
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  {order.items.map((item) => (
                    <li key={item.id}>{item.quantity}x {item.menuItem.name}</li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  {column === 'RECEIVED' && <button onClick={() => updateStatus(order.id, 'PREPARING')}>Start Prep</button>}
                  {column === 'PREPARING' && <button onClick={() => updateStatus(order.id, 'READY')}>Mark Ready</button>}
                  {column === 'READY' && <button onClick={() => updateStatus(order.id, 'SERVED')}>Mark Served</button>}
                </div>
              </div>
            ))}

            {orders.filter(o => o.status === column).length === 0 && (
              <p style={{ color: '#999', fontSize: '0.9em' }}>No orders</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
