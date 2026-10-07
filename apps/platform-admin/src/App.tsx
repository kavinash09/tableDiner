import React, { useState, useEffect } from 'react';

const App = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [tablesCount, setTablesCount] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchTenants = async () => {
    try {
      const res = await fetch('http://localhost:3001/admin/restaurants');
      const data = await res.json();
      setTenants(data);
    } catch (err) {
      console.error('Failed to fetch tenants', err);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('http://localhost:3001/admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName, restaurantName, tablesCount: Number(tablesCount) })
      });
      setTenantName('');
      setRestaurantName('');
      setTablesCount(1);
      fetchTenants();
    } catch (err) {
      console.error('Failed to create', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <h1>Platform Admin - TableDiner</h1>
      
      <div style={{ 
        background: '#f9f9f9', 
        padding: '16px', 
        borderRadius: '8px', 
        marginBottom: '24px' 
      }}>
        <h2>Onboard New Tenant</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>Tenant Name</label>
            <input 
              type="text" 
              value={tenantName} 
              onChange={e => setTenantName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>Restaurant Name</label>
            <input 
              type="text" 
              value={restaurantName} 
              onChange={e => setRestaurantName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>Number of Tables to Generate</label>
            <input 
              type="number" 
              min="1"
              max="50"
              value={tablesCount} 
              onChange={e => setTablesCount(Number(e.target.value))}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              padding: '12px 16px', 
              background: '#000', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              marginTop: '8px'
            }}>
            {loading ? 'Creating...' : 'Create Tenant & Restaurant'}
          </button>
        </form>
      </div>

      <h2>Existing Tenants</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {tenants.map(tenant => (
          <div key={tenant.id} style={{ 
            border: '1px solid #eaeaea', 
            borderRadius: '8px', 
            padding: '16px',
            flex: '1 1 300px',
            minWidth: '280px'
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>{tenant.name}</h3>
            {tenant.restaurants.map((restaurant: any) => (
              <div key={restaurant.id} style={{ marginTop: '12px', padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>{restaurant.name}</strong> 
                <span style={{ fontSize: '12px', color: '#666', background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px' }}>
                  Tier: {restaurant.subscriptionTier}
                </span>
                
                <div style={{ marginTop: '12px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Tables & QRs:</p>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {restaurant.tables.map((table: any) => (
                      <li key={table.id}>
                        {table.name} 
                        <br />
                        <code style={{ background: '#ddd', padding: '2px 4px', borderRadius: '4px', fontSize: '12px', wordBreak: 'break-all' }}>
                          {table.qrCode}
                        </code>
                        <br />
                        <a 
                          href={`http://localhost:5173/?qr=${table.qrCode}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontSize: '12px', color: '#0070f3', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>
                          Open Customer Web →
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        ))}
        {tenants.length === 0 && <p style={{ color: '#666' }}>No tenants found. Create one above.</p>}
      </div>
    </div>
  );
};

export default App;

