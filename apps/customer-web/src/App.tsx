import { useEffect, useState } from 'react';

export default function App() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Grab QR code from URL query params (e.g. ?qr=table-123)
    const params = new URLSearchParams(window.location.search);
    const qrCode = params.get('qr');

    if (!qrCode) {
      setError('No QR code found in URL. Please scan a table code (e.g., ?qr=YOUR-CODE).');
      return;
    }

    fetch(`http://localhost:3001/table/${qrCode}`)
      .then(res => {
        if (!res.ok) throw new Error('Table not found or invalid QR code.');
        return res.json();
      })
      .then(data => setData(data))
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  if (!data) return <div style={{ padding: '20px' }}>Loading menu...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>{data.restaurant.name}</h1>
      <h2 style={{ color: '#666' }}>Table: {data.table.name}</h2>
      
      {data.session ? (
        <div style={{ background: '#e0ffe0', padding: '10px', marginBottom: '20px', borderRadius: '8px' }}>
          <strong>Active Session:</strong> You can order now!
        </div>
      ) : (
        <div style={{ background: '#fffae0', padding: '10px', marginBottom: '20px', borderRadius: '8px' }}>
          No active session yet. Add items to cart to start.
        </div>
      )}

      <h3>Menu</h3>
      {data.menu.categories.map((category: any) => (
        <div key={category.id} style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>{category.name}</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {category.items.map((item: any) => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <div>
                  <strong>{item.name}</strong>
                  {item.description && <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: '#666' }}>{item.description}</p>}
                </div>
                <div>${item.price.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      
      {data.menu.uncategorized.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Other Items</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.menu.uncategorized.map((item: any) => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <div>
                  <strong>{item.name}</strong>
                  {item.description && <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: '#666' }}>{item.description}</p>}
                </div>
                <div>${item.price.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

