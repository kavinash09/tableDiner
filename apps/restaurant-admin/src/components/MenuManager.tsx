import React, { useState } from 'react';
import type { MenuCategory, MenuItem, Restaurant } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type FullRestaurant = Restaurant & { menuCategories: (MenuCategory & { items: MenuItem[] })[] };

export function MenuManager({ restaurant, fetchRestaurant }: { restaurant: FullRestaurant, fetchRestaurant: () => void }) {
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddingToCategory, setIsAddingToCategory] = useState<string | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setEditingItem(null);
    setIsAddingToCategory(null);
  };

  const handleCreateCategory = async () => {
    const name = window.prompt("New Category Name:");
    if (!name) return;
    try {
      await fetch(`${API_URL}/restaurant/${restaurant.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      fetchRestaurant();
    } catch(err) { console.error(err) }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Are you sure? This will delete all items in this category.")) return;
    try {
      await fetch(`${API_URL}/category/${id}`, { method: 'DELETE' });
      fetchRestaurant();
    } catch(err) { console.error(err) }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formName,
      description: formDesc || undefined,
      price: parseFloat(formPrice),
      categoryId: isAddingToCategory || editingItem?.categoryId || null
    };

    try {
      if (editingItem) {
        await fetch(`${API_URL}/menu-item/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${API_URL}/restaurant/${restaurant.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      fetchRestaurant();
      resetForm();
    } catch(err) { console.error(err) }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await fetch(`${API_URL}/menu-item/${id}`, { method: 'DELETE' });
      fetchRestaurant();
    } catch(err) { console.error(err) }
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDesc(item.description || '');
    setFormPrice(item.price.toString());
  };

  const startAdd = (categoryId: string) => {
    setIsAddingToCategory(categoryId);
    setFormName('');
    setFormDesc('');
    setFormPrice('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-forest-900">Menu Manager</h2>
          <button onClick={handleCreateCategory} className="px-4 py-2 bg-forest-900 text-white rounded-lg font-bold text-sm hover:bg-forest-800 transition-colors">
            + Add Category
          </button>
        </div>
        
        <div className="space-y-8">
          {restaurant.menuCategories.map(category => (
            <div key={category.id} className="border border-zinc-200 rounded-xl overflow-hidden">
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex justify-between items-center">
                <h3 className="font-bold text-forest-900">{category.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => startAdd(category.id)} className="text-sm font-bold text-forest-700 hover:text-forest-900">Add Item</button>
                  <button onClick={() => handleDeleteCategory(category.id)} className="text-sm font-bold text-red-500 hover:text-red-700 ml-4">Delete Category</button>
                </div>
              </div>
              <div className="divide-y divide-zinc-100">
                {category.items.length === 0 && (
                  <div className="p-4 text-center text-sm text-zinc-500 italic">No items yet</div>
                )}
                {category.items.map(item => (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-zinc-50 transition-colors gap-4">
                    <div className="flex items-center gap-4 flex-1 w-full">
                      {item.imageUrl ? (
                        <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_URL}${item.imageUrl}`} alt={item.name} className="h-16 w-16 object-cover rounded-lg border border-zinc-200 shrink-0" />
                      ) : (
                        <div className="h-16 w-16 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 text-xs text-center p-1 shrink-0">No Image</div>
                      )}
                      <div className="flex-1">
                        <div className="font-bold text-zinc-900">{item.name}</div>
                        {item.description && <div className="text-xs text-zinc-500 line-clamp-1">{item.description}</div>}
                        <div className="text-sm font-medium text-forest-700 mt-1">₹{item.price.toFixed(2)}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
                      <div className="relative group w-full sm:w-auto">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              const res = await fetch(`${API_URL}/menu-item/${item.id}/image`, { method: 'POST', body: formData });
                              if (res.ok) fetchRestaurant();
                            } catch(err) { console.error(err) }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="px-3 py-1.5 bg-zinc-100 text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors w-full sm:w-auto">
                          Upload Photo
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(item)} className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg hover:bg-amber-200 transition-colors">Edit</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="px-3 py-1.5 bg-red-100 text-red-800 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors">Del</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Modal Overlay */}
      {(editingItem || isAddingToCategory) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-forest-900 mb-4">{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Name</label>
                <input required type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-900" />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Description (Optional)</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-900" rows={3}></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Price (₹)</label>
                <input required type="number" step="0.01" min="0" value={formPrice} onChange={e => setFormPrice(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-900" />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-forest-900 text-white font-bold rounded-xl hover:bg-forest-800 transition-colors">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

