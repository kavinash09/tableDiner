import { useEffect, useState } from 'react';
import type { TableDetailsResponse, BillResponse, MenuItem, MenuCategory } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function App() {
  const [data, setData] = useState<TableDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState<BillResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const qrCode = params.get('qr');

  const fetchTableData = () => {
    if (!qrCode) {
      setError('No QR code found in URL. Please scan a table code (e.g., ?qr=table-1).');
      return;
    }
    fetch(`${API_URL}/table/${qrCode}`)
      .then(res => {
        if (!res.ok) throw new Error('Table not found or invalid QR code.');
        return res.json();
      })
      .then(data => setData(data))
      .catch(err => setError(err.message));
  };

  useEffect(() => { fetchTableData(); }, []);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !qrCode) return;
    setIsPlacingOrder(true);
    try {
      const res = await fetch(`${API_URL}/table/${qrCode}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })) }),
      });
      if (!res.ok) throw new Error('Failed to place order');
      setCart([]);
      alert('Order sent to kitchen! 🍳');
      fetchTableData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const viewBill = async () => {
    if (!qrCode) return;
    try {
      const res = await fetch(`${API_URL}/table/${qrCode}/bill`);
      if (!res.ok) throw new Error('Failed to fetch bill');
      const bill = await res.json();
      setBillData(bill);
      setShowBill(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const payBill = async () => {
    if (!qrCode || !billData) return;
    setIsPaying(true);
    try {
      const res = await fetch(`${API_URL}/table/${qrCode}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: billData.totalAmount }),
      });
      if (!res.ok) throw new Error('Payment failed');
      alert('Payment successful! Thank you for dining with us! 🍽️');
      setShowBill(false);
      fetchTableData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPaying(false);
    }
  };

  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  if (!data) return <div style={{ padding: '20px' }}>Loading menu...</div>;

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div style={{ padding: '20px 20px 100px 20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>{data.restaurant.name}</h1>
      <h2 style={{ color: '#666' }}>Table: {data.table.name}</h2>

      {data.session ? (
        <div style={{ background: '#e0ffe0', padding: '15px', marginBottom: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Active Session</strong><br />
            <span style={{ fontSize: '0.9em', color: '#555' }}>You have a running tab.</span>
          </div>
          <button onClick={viewBill} style={{ padding: '10px 16px', background: '#111', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            View Bill / Pay
          </button>
        </div>
      ) : (
        <div style={{ background: '#fffae0', padding: '10px', marginBottom: '20px', borderRadius: '8px' }}>
          No active session yet. Add items to cart to start.
        </div>
      )}

      <h3>Menu</h3>
      {data.menu.categories.map((category: MenuCategory & { items: MenuItem[] }) => (
        <div key={category.id} style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>{category.name}</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {category.items.map((item: MenuItem) => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #eee' }}>
                <div>
                  <strong>{item.name}</strong>
                  {item.description && <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: '#666' }}>{item.description}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <strong>₹{item.price.toFixed(2)}</strong>
                  <button onClick={() => addToCart(item)} style={{ padding: '8px 16px', background: '#111', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Add to Cart
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Floating Sticky Cart */}
      {cart.length > 0 && !showBill && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '20px', boxShadow: '0 -4px 15px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: '600px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '1.2em' }}>Total: ₹{cartTotal.toFixed(2)}</strong>
              <div style={{ fontSize: '0.9em', color: '#666' }}>{cart.length} item(s)</div>
            </div>
            <button disabled={isPlacingOrder} onClick={placeOrder}
              style={{ padding: '12px 24px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1em', fontWeight: 'bold', cursor: isPlacingOrder ? 'wait' : 'pointer' }}>
              {isPlacingOrder ? 'Sending...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {showBill && billData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '600px', borderRadius: '16px 16px 0 0', padding: '24px', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Your Bill</h2>
              <button onClick={() => setShowBill(false)} style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
              {billData.itemized.map((item: { name: string; quantity: number; lineTotal: number }, idx: number) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <div><strong>{item.name}</strong> x {item.quantity}</div>
                  <div>₹{item.lineTotal.toFixed(2)}</div>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #000', paddingTop: '20px', marginBottom: '20px' }}>
              <strong style={{ fontSize: '1.5em' }}>Total</strong>
              <strong style={{ fontSize: '1.5em' }}>₹{billData.totalAmount.toFixed(2)}</strong>
            </div>
            <button onClick={payBill} disabled={isPaying}
              style={{ width: '100%', padding: '16px', background: '#000', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2em', fontWeight: 'bold', cursor: isPaying ? 'wait' : 'pointer' }}>
              {isPaying ? 'Processing...' : 'Pay & Close Tab'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
