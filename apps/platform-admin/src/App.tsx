import React, { useState, useEffect } from 'react';
import type { AdminRestaurantsResponse } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const App = () => {
  const [tenants, setTenants] = useState<AdminRestaurantsResponse>([]);
  const [tenantName, setTenantName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [tablesCount, setTablesCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/restaurants`);
      const data = await res.json();
      setTenants(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch tenants', 'error');
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/admin/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName, restaurantName, tablesCount: Number(tablesCount) })
      });
      setTenantName('');
      setRestaurantName('');
      setTablesCount(1);
      showToast('Tenant and restaurant created successfully!', 'success');
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to create tenant', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper py-8 px-4 sm:px-6 lg:px-8 font-sans text-forest-900">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-forest-900">Platform Admin</h1>
          <p className="text-zinc-500 mt-2">Manage tenants, restaurants, and QR code generation.</p>
        </header>
        
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 border-b border-zinc-200 bg-paper/50">
            <h2 className="text-xl font-semibold text-forest-900">Onboard New Tenant</h2>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tenant Name</label>
                <input 
                  type="text" 
                  value={tenantName} 
                  onChange={e => setTenantName(e.target.value)}
                  required
                  placeholder="e.g. Acme Corp"
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 focus:border-forest-900 focus:ring-1 focus:ring-forest-900 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Restaurant Name</label>
                <input 
                  type="text" 
                  value={restaurantName} 
                  onChange={e => setRestaurantName(e.target.value)}
                  required
                  placeholder="e.g. The Rusty Spoon"
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 focus:border-forest-900 focus:ring-1 focus:ring-forest-900 outline-none transition-shadow"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Number of Tables to Generate</label>
              <input 
                type="number" 
                min="1"
                max="50"
                value={tablesCount} 
                onChange={e => setTablesCount(Number(e.target.value))}
                required
                className="w-full max-w-[200px] px-4 py-2.5 rounded-lg border border-zinc-300 focus:border-forest-900 focus:ring-1 focus:ring-forest-900 outline-none transition-shadow"
              />
            </div>
            
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className={`px-6 py-2.5 rounded-xl text-white font-semibold text-sm shadow-sm active:scale-95 transition-all ${loading ? 'bg-zinc-700 cursor-wait' : 'bg-forest-900 hover:bg-forest-800'}`}>
                {loading ? 'Creating...' : 'Create Tenant & Restaurant'}
              </button>
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-forest-900 mb-4">Existing Tenants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tenants.map(tenant => (
              <div key={tenant.id} className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
                <h3 className="text-xl font-bold text-forest-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {tenant.name}
                </h3>
                
                <div className="space-y-4">
                  {tenant.restaurants.map((restaurant) => (
                    <div key={restaurant.id} className="bg-paper border border-zinc-100 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <strong className="text-forest-900 font-semibold">{restaurant.name}</strong> 
                        <span className="text-[11px] font-medium uppercase tracking-wider bg-zinc-200/60 text-zinc-600 px-2.5 py-1 rounded-md">
                          {restaurant.subscriptionTier}
                        </span>
                      </div>
                      
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Tables & QRs</p>
                        <ul className="space-y-3">
                          {restaurant.tables.map((table) => (
                            <li key={table.id} className="flex flex-col gap-1.5 bg-white p-3 rounded-lg border border-zinc-100 shadow-sm">
                              <span className="text-sm font-medium text-forest-900">{table.name}</span> 
                              <code className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded truncate select-all">
                                {table.qrCode}
                              </code>
                              <a 
                                href={`http://localhost:5173/?qr=${table.qrCode}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 mt-1">
                                Open Customer Web
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {tenants.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm">
                <p className="text-zinc-500">No tenants found. Create one above to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-forest-900 text-white'}`}>
            {toast.type === 'error' ? (
              <svg className="w-5 h-5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

