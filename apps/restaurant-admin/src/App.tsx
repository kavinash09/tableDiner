import { useEffect, useState } from 'react';
import type { KitchenOrdersResponse, Restaurant, Table, MenuCategory, MenuItem } from '@tablediner/shared-types';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type FullRestaurant = Restaurant & { tables: Table[], menuCategories: (MenuCategory & { items: MenuItem[] })[] };

export default function App() {
  const [activeTab, setActiveTab] = useState<'KITCHEN' | 'SETTINGS' | 'MENU'>('KITCHEN');
  
  // Kitchen State
  const [orders, setOrders] = useState<KitchenOrdersResponse>([]);
  const [error, setError] = useState<string | null>(null);

  // Settings State
  const [restaurant, setRestaurant] = useState<FullRestaurant | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Initial Fetch
  useEffect(() => {
    fetchOrders();
    fetchRestaurant();
    const interval = setInterval(() => {
      if (activeTab === 'KITCHEN') fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchOrders = () => {
    fetch(`${API_URL}/kitchen/orders`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then(data => {
        setOrders(data);
        setError(null);
      })
      .catch(err => setError('Connection lost'));
  };

  const fetchRestaurant = () => {
    fetch(`${API_URL}/restaurant/current`)
      .then(res => res.json())
      .then(data => setRestaurant(data))
      .catch(err => console.error(err));
  };

  const updateStatus = (orderId: string, status: string) => {
    fetch(`${API_URL}/kitchen/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(() => fetchOrders());
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    setSavingSettings(true);
    fetch(`${API_URL}/restaurant/${restaurant.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: restaurant.theme, qrTemplate: restaurant.qrTemplate })
    })
      .then(res => res.json())
      .then(data => {
        setRestaurant(prev => prev ? { ...prev, ...data } : prev);
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      })
      .finally(() => setSavingSettings(false));
  };

  const getQRUrl = (qrCode: string) => {
    // Determine the customer-web origin
    const origin = window.location.origin.replace('5174', '5176').replace('5175', '5176');
    return `${origin}/?qr=${qrCode}`;
  };

  return (
    <div className="min-h-screen p-6 bg-paper font-sans">
      <header className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-900 flex items-center gap-2">
            {restaurant?.name || 'Restaurant Admin'}
          </h1>
          {activeTab === 'KITCHEN' && (
            <p className="text-sm font-medium text-zinc-500 mt-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-forest-700 animate-pulse'}`}></span>
              {error ? 'Reconnecting...' : 'Live updating...'}
            </p>
          )}
        </div>
        
        <div className="flex bg-zinc-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('KITCHEN')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'KITCHEN' ? 'bg-white text-forest-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            👨‍🍳 Kitchen
          </button>
          <button 
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'SETTINGS' ? 'bg-white text-forest-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            ⚙️ Settings & QRs
          </button>
          <button 
            onClick={() => setActiveTab('MENU')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'MENU' ? 'bg-white text-forest-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            📋 Menu
          </button>
        </div>
      </header>

      {error && activeTab === 'KITCHEN' && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in mb-6">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Connection Lost
        </div>
      )}

      {activeTab === 'KITCHEN' && (
        <div className="flex flex-wrap gap-6">
          {['RECEIVED', 'PREPARING', 'READY'].map(column => (
            <div key={column} className="flex-1 min-w-[300px] bg-zinc-100/50 border border-zinc-200 p-4 rounded-2xl flex flex-col h-full min-h-[500px]">
              <h3 className="text-sm font-bold text-forest-900 tracking-wider mb-4 pb-3 border-b border-zinc-200/80">{column}</h3>

              <div className="space-y-4 flex-1">
                {orders.filter(o => o.status === column).map(order => (
                  <div key={order.id} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm transition-all">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-zinc-100">
                      <strong className="text-forest-900 text-lg font-bold">{order.session?.table?.name || 'Unknown Table'}</strong>
                      <span className="text-zinc-400 font-mono text-sm">#{order.id.slice(-4)}</span>
                    </div>
                    <ul className="space-y-3 mb-5">
                      {order.items.map((item) => (
                        <li key={item.id} className="text-forest-800">
                          <div className="flex items-start">
                            <strong className="text-forest-900 font-bold w-6 shrink-0">{item.quantity}x</strong> 
                            <span className="font-medium text-zinc-700">{item.menuItem.name}</span>
                          </div>
                          {item.notes && (
                            <div className="ml-6 mt-1 text-xs font-bold text-rose-600 bg-rose-50 inline-block px-2 py-1 rounded-md">
                              Note: {item.notes}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      {column === 'RECEIVED' && (
                        <button onClick={() => updateStatus(order.id, 'PREPARING')} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-all">Start Prep</button>
                      )}
                      {column === 'PREPARING' && (
                        <>
                          <button onClick={() => updateStatus(order.id, 'RECEIVED')} className="px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-all" title="Move back to Received">←</button>
                          <button onClick={() => updateStatus(order.id, 'READY')} className="flex-1 py-2.5 bg-forest-700 hover:bg-forest-800 text-white rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-all">Mark Ready</button>
                        </>
                      )}
                      {column === 'READY' && (
                        <>
                          <button onClick={() => updateStatus(order.id, 'PREPARING')} className="px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-all" title="Move back to Preparing">←</button>
                          <button onClick={() => updateStatus(order.id, 'SERVED')} className="flex-1 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-all">Mark Served</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {orders.filter(o => o.status === column).length === 0 && (
                  <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-zinc-200 rounded-xl">
                    <p className="text-zinc-400 font-medium text-sm">No orders in this column</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'SETTINGS' && restaurant && (
        <div className="max-w-4xl mx-auto space-y-8">
          <form onSubmit={saveSettings} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
            <h2 className="text-xl font-bold text-forest-900 mb-6">Customization Settings</h2>
            
            <div className="grid sm:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Customer UI Theme</label>
                <select 
                  value={restaurant.theme} 
                  onChange={e => setRestaurant({ ...restaurant, theme: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-900"
                >
                  <option value="FOREST">Forest Green (Clipboard)</option>
                  <option value="MODERN_ZINC">Modern Zinc</option>
                  <option value="CLASSIC_OCEAN">Classic Ocean</option>
                </select>
                <p className="text-xs text-zinc-500 mt-2">Changes the colors and styling on the customer ordering app.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">QR Code Print Template</label>
                <select 
                  value={restaurant.qrTemplate} 
                  onChange={e => setRestaurant({ ...restaurant, qrTemplate: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-900"
                >
                  <option value="MINIMAL">Minimal (Black & White)</option>
                  <option value="PLAYFUL">Playful (Rounded with colors)</option>
                  <option value="ELEGANT">Elegant (Serif styling)</option>
                </select>
                <p className="text-xs text-zinc-500 mt-2">Changes how your printable QR codes below are styled.</p>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-bold text-zinc-700 mb-2">Restaurant Banner Image</label>
              <div className="flex items-center gap-4">
                {restaurant.bannerUrl && (
                  <img src={restaurant.bannerUrl.startsWith('http') ? restaurant.bannerUrl : `${API_URL}${restaurant.bannerUrl}`} alt="Banner" className="h-20 w-32 object-cover rounded-xl border border-zinc-200" />
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                      const res = await fetch(`${API_URL}/restaurant/${restaurant.id}/banner`, {
                        method: 'POST',
                        body: formData
                      });
                      if (res.ok) fetchRestaurant();
                    } catch(err) { console.error(err) }
                  }}
                  className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-forest-50 file:text-forest-700 hover:file:bg-forest-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-zinc-200 pt-6">
              <button disabled={savingSettings} type="submit" className="px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl font-bold shadow-sm active:scale-95 transition-all">
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              {settingsSuccess && <span className="text-forest-700 text-sm font-bold flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Saved!</span>}
            </div>
          </form>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-forest-900">QR Code Generator</h2>
              <button onClick={() => window.print()} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurant.tables.map(table => (
                <div key={table.id} className={`flex flex-col items-center justify-center p-8 border-2 rounded-3xl ${
                  restaurant.qrTemplate === 'PLAYFUL' ? 'border-amber-400 bg-amber-50 shadow-xl' :
                  restaurant.qrTemplate === 'ELEGANT' ? 'border-forest-900 bg-paper-dark' :
                  'border-zinc-900 bg-white'
                }`}>
                  <h3 className={`mb-6 tracking-wider ${
                    restaurant.qrTemplate === 'PLAYFUL' ? 'text-xl font-bold text-amber-600 font-sans uppercase' :
                    restaurant.qrTemplate === 'ELEGANT' ? 'text-2xl font-bold text-forest-900 font-serif' :
                    'text-lg font-bold text-zinc-900 font-mono uppercase'
                  }`}>{table.name}</h3>
                  
                  <div className="bg-white p-2 rounded-xl shadow-sm mb-4">
                    <QRCodeSVG 
                      value={getQRUrl(table.qrCode)} 
                      size={160} 
                      level="H"
                      fgColor={restaurant.qrTemplate === 'ELEGANT' ? '#14351A' : restaurant.qrTemplate === 'PLAYFUL' ? '#b45309' : '#000000'}
                      bgColor="#ffffff"
                    />
                  </div>
                  
                  <p className={`text-sm mt-2 text-center ${
                    restaurant.qrTemplate === 'PLAYFUL' ? 'text-amber-700 font-medium' :
                    restaurant.qrTemplate === 'ELEGANT' ? 'text-forest-900/70 font-serif italic' :
                    'text-zinc-500 font-mono'
                  }`}>
                    {restaurant.qrTemplate === 'ELEGANT' ? 'Scan to view our menu & order' : 'Scan to Order!'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'MENU' && restaurant && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
            <h2 className="text-xl font-bold text-forest-900 mb-6">Menu Manager</h2>
            
            <div className="space-y-8">
              {restaurant.menuCategories.map(category => (
                <div key={category.id} className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
                    <h3 className="font-bold text-forest-900">{category.name}</h3>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {category.items.map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                        <div className="flex items-center gap-4">
                          {item.imageUrl ? (
                            <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_URL}${item.imageUrl}`} alt={item.name} className="h-16 w-16 object-cover rounded-lg border border-zinc-200" />
                          ) : (
                            <div className="h-16 w-16 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 text-xs text-center p-1">No Image</div>
                          )}
                          <div>
                            <div className="font-bold text-zinc-900">{item.name}</div>
                            <div className="text-sm text-zinc-500">₹{item.price.toFixed(2)}</div>
                          </div>
                        </div>
                        
                        <div>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const formData = new FormData();
                              formData.append('file', file);
                              try {
                                const res = await fetch(`${API_URL}/menu-item/${item.id}/image`, {
                                  method: 'POST',
                                  body: formData
                                });
                                if (res.ok) fetchRestaurant();
                              } catch(err) { console.error(err) }
                            }}
                            className="block w-full text-sm text-zinc-500 file:mr-0 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
