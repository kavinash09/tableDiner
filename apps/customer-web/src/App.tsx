import { useEffect, useState } from 'react';
import type { TableDetailsResponse, BillResponse, MenuItem, MenuCategory } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

export default function App() {
  const [data, setData] = useState<TableDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState<BillResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: '' }];
    });
    showToast(`Added ${item.name} to cart`);
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.menuItemId === menuItemId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updateNotes = (menuItemId: string, notes: string) => {
    setCart(prev => prev.map(item => item.menuItemId === menuItemId ? { ...item, notes } : item));
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => prev.filter(i => i.menuItemId !== menuItemId));
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !qrCode) return;
    setIsPlacingOrder(true);
    try {
      const res = await fetch(`${API_URL}/table/${qrCode}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: cart.map(i => ({ 
            menuItemId: i.menuItemId, 
            quantity: i.quantity,
            notes: i.notes || undefined
          })) 
        }),
      });
      if (!res.ok) throw new Error('Failed to place order');
      setCart([]);
      setShowCartModal(false);
      showToast('Order sent to kitchen!', 'success');
      fetchTableData();
    } catch (err: any) {
      showToast(err.message || 'Failed to place order', 'error');
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
      showToast(err.message || 'Failed to view bill', 'error');
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
      showToast('Payment successful! Thank you for dining with us!', 'success');
      setShowBill(false);
      fetchTableData();
    } catch (err: any) {
      showToast(err.message || 'Payment failed', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-wood flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="bg-paper p-8 rounded border-2 border-forest-900/20 max-w-sm w-full shadow-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-bold text-forest-900 mb-2">Oops!</h2>
          <p className="text-forest-900/70 mb-6">{error}</p>
          <button onClick={fetchTableData} className="px-6 py-2.5 bg-forest-900 text-paper font-semibold uppercase tracking-wider text-sm rounded hover:bg-forest-800 transition-colors w-full">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-wood py-8 px-4 flex justify-center">
        <div className="max-w-xl w-full bg-paper shadow-2xl animate-pulse h-[80vh]"></div>
      </div>
    );
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const themeVars = data.restaurant.theme === 'MODERN_ZINC' ? {
    '--color-wood': '#e4e4e7',
    '--color-paper': '#ffffff',
    '--color-paper-dark': '#f4f4f5',
    '--color-forest-900': '#18181b', // zinc-900
    '--color-forest-800': '#27272a',
    '--color-forest-700': '#3f3f46',
    '--font-serif': 'Barlow, sans-serif',
  } : data.restaurant.theme === 'CLASSIC_OCEAN' ? {
    '--color-wood': '#0f172a', // slate-900
    '--color-paper': '#f8fafc',
    '--color-paper-dark': '#e2e8f0',
    '--color-forest-900': '#0f172a',
    '--color-forest-800': '#1e293b',
    '--color-forest-700': '#334155',
  } : {}; // FOREST defaults from index.css

  return (
    <div className="min-h-screen bg-wood py-8 sm:py-12 px-4 flex justify-center font-sans transition-colors duration-500" style={themeVars as React.CSSProperties}>
      <div className="max-w-xl w-full relative">
        {/* Clipboard Clip */}
        <div className="flex justify-center -mb-5 relative z-10 drop-shadow-xl">
          <div className="w-32 h-14 bg-zinc-400 rounded-t-xl border-b-8 border-zinc-500 shadow-inner flex flex-col items-center justify-end pb-2">
            <div className="w-16 h-2 bg-zinc-600 rounded-full mb-1 opacity-50"></div>
          </div>
        </div>

        {/* Paper Menu */}
        <div className="bg-paper shadow-2xl pb-32">
          {/* Inner Delicate Frame */}
          <div className="m-4 sm:m-6 p-6 sm:p-8 border border-forest-900/30 relative">
            {/* Corner Ornaments */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-forest-900 -mt-[1px] -ml-[1px]"></div>
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-forest-900 -mt-[1px] -mr-[1px]"></div>
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-forest-900 -mb-[1px] -ml-[1px]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-forest-900 -mb-[1px] -mr-[1px]"></div>

            <header className="text-center mb-12 border-b border-forest-900/20 pb-8">
              {data.restaurant.bannerUrl && (
                <div className="mb-6 flex justify-center">
                  <img 
                    src={data.restaurant.bannerUrl.startsWith('http') ? data.restaurant.bannerUrl : `${API_URL}${data.restaurant.bannerUrl}`} 
                    alt={`${data.restaurant.name} Banner`} 
                    className="w-full h-48 object-cover rounded-sm border border-forest-900/20 shadow-sm"
                  />
                </div>
              )}
              <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-forest-900 uppercase">
                {data.restaurant.name}
              </h1>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="w-12 h-[1px] bg-forest-900/30"></span>
                <h2 className="font-sans text-xs font-semibold tracking-[0.2em] uppercase text-forest-900/60">
                  Table {data.table.name}
                </h2>
                <span className="w-12 h-[1px] bg-forest-900/30"></span>
              </div>
            </header>

            {data.session ? (
              <div className="bg-forest-50 border border-forest-900/20 p-4 mb-10 text-center relative overflow-hidden">
                <div className="relative z-10">
                  <strong className="font-serif text-lg text-forest-900 block mb-1">Active Tab</strong>
                  <div className="text-sm text-forest-900/70 mb-3">You have orders in progress.</div>
                  <button onClick={viewBill} className="px-6 py-2 bg-forest-900 text-paper text-sm font-semibold uppercase tracking-wider border border-forest-900 hover:bg-forest-800 transition-colors">
                    View Bill & Pay
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center mb-10 text-sm font-medium tracking-wide text-forest-900/50 uppercase">
                Select items below to begin
              </div>
            )}

            <div className="space-y-12">
              {data.menu.categories.map((category: MenuCategory & { items: MenuItem[] }) => (
                <div key={category.id}>
                  <div className="text-center mb-8">
                    <h3 className="font-serif text-2xl font-bold text-forest-900 uppercase tracking-widest">
                      {category.name}
                    </h3>
                    <div className="font-sans text-xs font-semibold tracking-widest text-forest-900/50 uppercase mt-1">
                      {category.name === 'Starters' ? 'PRZYSTAWKI' : category.name === 'Mains' ? 'DANIA GŁÓWNE' : 'MENU'}
                    </div>
                  </div>
                  <div className="space-y-8">
                    {category.items.map((item: MenuItem) => (
                      <div key={item.id} className="group relative flex gap-4">
                        {item.imageUrl && (
                          <div className="shrink-0 w-24 h-24 bg-forest-900/5 rounded-sm overflow-hidden border border-forest-900/20 shadow-sm mt-1">
                            <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_URL}${item.imageUrl}`} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <strong className="font-serif text-xl text-forest-900 bg-paper pr-2 relative z-10 truncate">{item.name}</strong>
                            <div className="flex-1 border-b border-dotted border-forest-900/30 mx-2 relative top-[-6px]"></div>
                            <span className="font-sans text-forest-900 font-semibold bg-paper pl-2 relative z-10 tabular-nums shrink-0">
                              ₹{item.price.toFixed(2)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="font-sans text-sm text-forest-900/70 leading-relaxed pr-2 mb-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <button 
                            onClick={() => addToCart(item)} 
                            className="mt-1 text-xs font-bold uppercase tracking-wider text-forest-900/50 hover:text-forest-900 transition-colors flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Add to order
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating View Cart Button */}
        {cart.length > 0 && !showBill && !showCartModal && (
          <div className="fixed bottom-0 left-0 right-0 bg-paper/90 backdrop-blur-md border-t-2 border-forest-900/20 p-4 sm:p-6 shadow-[0_-8px_30px_rgba(20,53,26,0.15)] flex justify-center z-40">
            <div className="max-w-xl w-full flex justify-between items-center px-2">
              <div>
                <strong className="font-serif text-xl font-bold text-forest-900 tabular-nums">Total: ₹{cartTotal.toFixed(2)}</strong>
                <div className="font-sans text-sm font-medium text-forest-900/60 uppercase tracking-wide">{cart.length} item(s)</div>
              </div>
              <button onClick={() => setShowCartModal(true)}
                className="px-8 py-3 bg-forest-900 text-paper font-semibold uppercase tracking-widest text-sm hover:bg-forest-800 transition-colors">
                View Cart
              </button>
            </div>
          </div>
        )}

        {/* Cart Modal */}
        {showCartModal && (
          <div className="fixed inset-0 bg-wood/80 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-0 sm:p-6">
            <div className="bg-paper border border-forest-900/20 w-full max-w-xl rounded-t-xl sm:rounded-xl p-6 sm:p-8 max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-forest-900/20 shrink-0">
                <h2 className="font-serif text-3xl font-bold text-forest-900">Your Order</h2>
                <button onClick={() => setShowCartModal(false)} className="text-forest-900/50 hover:text-forest-900 transition-colors">
                  <span className="sr-only">Close</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 pb-4">
                {cart.length === 0 ? (
                  <p className="text-forest-900/60 text-center py-12 font-serif text-lg italic">Your cart is empty.</p>
                ) : (
                  <ul className="space-y-6">
                    {cart.map((item) => (
                      <li key={item.menuItemId} className="bg-paper-dark p-4 border border-forest-900/10">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <strong className="font-serif text-xl text-forest-900 block">{item.name}</strong>
                            <span className="font-sans text-forest-900/70 text-sm tabular-nums">₹{item.price.toFixed(2)} each</span>
                          </div>
                          <button onClick={() => removeFromCart(item.menuItemId)} className="text-forest-900/40 hover:text-red-700 transition-colors p-1" aria-label="Remove item">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center border border-forest-900/20 bg-paper">
                            <button onClick={() => updateQuantity(item.menuItemId, -1)} className="px-3 py-1 text-forest-900 hover:bg-forest-900/5 transition-colors">−</button>
                            <span className="px-4 py-1 font-semibold text-forest-900 min-w-[2.5rem] text-center border-l border-r border-forest-900/20">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.menuItemId, 1)} className="px-3 py-1 text-forest-900 hover:bg-forest-900/5 transition-colors">+</button>
                          </div>
                          <span className="font-semibold text-forest-900 tabular-nums ml-auto">₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        
                        <input 
                          type="text" 
                          placeholder="Special instructions (e.g., no onions)..." 
                          value={item.notes}
                          onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
                          className="w-full bg-paper border-b border-forest-900/30 px-0 py-2 text-sm text-forest-900 placeholder:text-forest-900/40 focus:outline-none focus:border-forest-900 bg-transparent rounded-none"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-forest-900/20 pt-6 shrink-0 mt-2">
                  <div className="flex justify-between items-center mb-6">
                    <strong className="font-serif text-2xl font-bold text-forest-900">Total</strong>
                    <strong className="font-sans text-2xl font-bold text-forest-900 tabular-nums">₹{cartTotal.toFixed(2)}</strong>
                  </div>
                  <button disabled={isPlacingOrder} onClick={placeOrder}
                    className={`w-full py-4 text-paper font-semibold uppercase tracking-widest text-sm transition-all ${isPlacingOrder ? 'bg-forest-700 cursor-wait' : 'bg-forest-900 hover:bg-forest-800 active:bg-forest-950'}`}>
                    {isPlacingOrder ? 'Sending to Kitchen...' : 'Send to Kitchen'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bill Modal */}
        {showBill && billData && (
          <div className="fixed inset-0 bg-wood/80 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-0 sm:p-6">
            <div className="bg-paper border border-forest-900/20 w-full max-w-xl rounded-t-xl sm:rounded-xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-forest-900/20">
                <h2 className="font-serif text-3xl font-bold text-forest-900">Your Bill</h2>
                <button onClick={() => setShowBill(false)} className="text-forest-900/50 hover:text-forest-900 transition-colors">
                  <span className="sr-only">Close</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <ul className="space-y-4 mb-8">
                {billData.itemized.map((item: { name: string; quantity: number; lineTotal: number }, idx: number) => (
                  <li key={idx} className="flex justify-between items-baseline text-forest-900">
                    <div className="flex-1 flex items-baseline">
                      <strong className="font-serif text-lg font-normal bg-paper pr-2 relative z-10">{item.name}</strong>
                      <span className="text-forest-900/50 mx-1 text-sm bg-paper px-1 relative z-10">x {item.quantity}</span>
                      <div className="flex-1 border-b border-dotted border-forest-900/30 mx-2 relative top-[-4px]"></div>
                    </div>
                    <span className="tabular-nums font-semibold bg-paper pl-2 relative z-10">₹{item.lineTotal.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center border-t border-forest-900/20 pt-6 mb-8">
                <strong className="font-serif text-2xl font-bold text-forest-900">Total</strong>
                <strong className="font-sans text-2xl font-bold text-forest-900 tabular-nums">₹{billData.totalAmount.toFixed(2)}</strong>
              </div>
              <button onClick={payBill} disabled={isPaying}
                className={`w-full py-4 text-paper font-semibold uppercase tracking-widest text-sm transition-all ${isPaying ? 'bg-forest-700 cursor-wait' : 'bg-forest-900 hover:bg-forest-800'}`}>
                {isPaying ? 'Processing Payment...' : 'Pay & Close Tab'}
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
            <div className={`px-6 py-4 border shadow-2xl flex items-center gap-3 ${toast.type === 'error' ? 'bg-[#fcf8f8] border-red-200 text-red-900' : 'bg-forest-900 text-paper border-forest-900'}`}>
              <span className="font-sans text-sm tracking-wide uppercase font-semibold">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
