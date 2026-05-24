import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, ChevronRight, CheckCircle2, Circle, Plus, Trash2, Share2, Copy, Check, X } from 'lucide-react';
import { Dish, WeeklyPlan, Ingredient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

interface ShoppingListProps {
  groupId: string;
  plan: WeeklyPlan | null;
  dishes: Dish[];
  plans?: WeeklyPlan[];
}

interface ToBuyItem extends Ingredient {
  id: string;
  _id?: string;
  purchased: boolean;
}

export default function ShoppingList({ groupId, plan, dishes, plans }: ShoppingListProps) {
  const [toBuyList, setToBuyList] = useState<ToBuyItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

    // States for the manual custom addition modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Other');

  // State for the suggested week ingredients tabs: current week, following week, or both
  const [activeWeekTab, setActiveWeekTab] = useState<'current' | 'following' | 'both'>('current');

  const customCategories = [
    'Vegetables',
    'Proteins',
    'Dairy/Eggs',
    'Pantry',
    'Bakery',
    'Beverages',
    'Other'
  ];

  const fetchShoppingList = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/groups/${groupId}/shopping-list`);
      if (res.ok) {
        setToBuyList(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch shopping list", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchShoppingList();
  }, [fetchShoppingList]);

  const handleAddToBuy = async (ing: Ingredient) => {
    try {
      const res = await apiFetch(`/api/groups/${groupId}/shopping-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ing.name,
          quantity: ing.quantity,
          category: ing.category,
          purchased: false
        })
      });
      if (res.ok) {
        const newItem = await res.json();
        setToBuyList(prev => [...prev, newItem]);
      }
    } catch (error) {
      console.error("Failed to add to shopping list", error);
    }
  };

  const handleCustomAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    await handleAddToBuy({
      name: newItemName.trim(),
      quantity: newItemQuantity.trim() || '1 unit',
      category: newItemCategory
    });

    // Reset and close
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemCategory('Other');
    setIsAddModalOpen(false);
  };

const togglePurchased = async (item: ToBuyItem) => {
    try {
      // 1. Optimistic update for the UI
      const newPurchasedStatus = !item.purchased;
      setToBuyList(prev => prev.map(i => i.id === item.id ? { ...i, purchased: newPurchasedStatus } : i));
      
      // 2. The API Call
      const res = await apiFetch(`/api/shopping-list/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...item,                    // FIX: Spread the entire item (name, quantity, category)
          purchased: newPurchasedStatus // Override with the new status
        })
      });
      
      if (!res.ok) {
        // Revert on failure
        const errorData = await res.json();
        console.error("Server validation failed:", errorData);
        setToBuyList(prev => prev.map(i => i.id === item.id ? { ...i, purchased: item.purchased } : i));
      }
    } catch (error) {
      console.error("Failed to toggle purchased status", error);
      setToBuyList(prev => prev.map(i => i.id === item.id ? { ...i, purchased: item.purchased } : i));
    }
  };

  const removeToBuy = async (id: string) => {
    try {
      // Optimistic update
      const original = [...toBuyList];
      setToBuyList(prev => prev.filter(item => item.id !== id));
      
      const res = await apiFetch(`/api/shopping-list/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        setToBuyList(original);
      }
    } catch (error) {
      console.error("Failed to remove item", error);
      fetchShoppingList();
    }
  };

  // Helper date/week conversions
  const getWeekId = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  };

  const currentWeekIdStr = getWeekId(new Date());

  const nextWeekDate = new Date();
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const followingWeekIdStr = getWeekId(nextWeekDate);

  // Retrieve current and following week plans
  const currentWeekPlan = plans ? plans.find(p => p.weekId === currentWeekIdStr) : plan;
  const followingWeekPlan = plans ? plans.find(p => p.weekId === followingWeekIdStr) : null;

  // Decide which plan structures to aggregate based on selected tab
  let selectedPlans: WeeklyPlan[] = [];
  if (activeWeekTab === 'current') {
    if (currentWeekPlan) selectedPlans = [currentWeekPlan];
  } else if (activeWeekTab === 'following') {
    if (followingWeekPlan) selectedPlans = [followingWeekPlan];
  } else if (activeWeekTab === 'both') {
    const arr = [];
    if (currentWeekPlan) arr.push(currentWeekPlan);
    if (followingWeekPlan) arr.push(followingWeekPlan);
    selectedPlans = arr;
  }

  // Aggregate ingredients helper
  const aggregatedIngredients: Record<string, Ingredient[]> = {};
  selectedPlans.forEach(p => {
    if (!p || !p.days) return;
    Object.values(p.days).forEach(day => {
      [day.lunch, day.dinner].forEach(slot => {
        const dishIds = slot.dishIds || [];
        dishIds.forEach(dishId => {
          const dish = dishes.find(d => (d.id === dishId || (d as any)._id === dishId));
          dish?.ingredients.forEach(ing => {
            const cat = ing.category || 'Other';
            if (!aggregatedIngredients[cat]) aggregatedIngredients[cat] = [];
            
            const existing = aggregatedIngredients[cat].find(i => i.name.toLowerCase() === ing.name.toLowerCase());
            if (existing) {
              if (!existing.quantity.includes(ing.quantity)) {
                 existing.quantity = `${existing.quantity}, ${ing.quantity}`;
              }
            } else {
              aggregatedIngredients[cat].push({ ...ing });
            }
          });
        });
      });
    });
  });

  const categories = Object.keys(aggregatedIngredients).sort();

  const handleShare = () => {
    const text = toBuyList
      .map(item => `${item.purchased ? '[x]' : '[ ]'} ${item.name} (${item.quantity})`)
      .join('\n');
    
    const shareData = {
      title: 'My Shopping List',
      text: `🛒 My Shopping List from MealFlow:\n\n${text || 'Empty list'}`,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareData.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const clearCompleted = async () => {
    try {
      setToBuyList(prev => prev.filter(i => !i.purchased));
      await apiFetch(`/api/groups/${groupId}/shopping-list/completed`, { method: 'DELETE' });
    } catch (error) {
      console.error("Failed to clear completed items", error);
      fetchShoppingList();
    }
  };

  return (
    <div className="space-y-10">
      {/* Upper Section: Real Shopping List */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl md:text-4xl font-bold mb-2">My Shopping List</h2>
              <p className="text-slate-400 text-sm font-medium">Items you need to buy for your space</p>
            </div>

                        
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 hover:text-white text-slate-100 rounded-2xl transition-all font-bold text-sm border border-white/10 shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Item
              </button>
              
              {toBuyList.length > 0 && (
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl transition-all font-bold text-sm shadow-xl shadow-emerald-900/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {copied ? 'Copied to Clipboard' : 'Share'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-2 min-h-[100px]">
            <AnimatePresence mode="popLayout">
              {loading ? (
                 <motion.div 
                   key="loading"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="py-12 text-center text-slate-500 font-medium flex flex-col items-center gap-3"
                 >
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                     className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full"
                   />
                   Loading your list...
                 </motion.div>
              ) : toBuyList.length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 text-center text-slate-500 font-medium"
                >
                  Your "To Buy" list is empty. Add custom items manually, or add listed ones below!
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                    {toBuyList.map(item => (
                      <motion.div 
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                          item.purchased ? 'bg-white/5 opacity-50' : 'bg-white/10 hover:bg-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => togglePurchased(item)}>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            item.purchased ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
                          }`}>
                            {item.purchased && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-bold text-sm ${item.purchased ? 'line-through text-slate-400' : 'text-white'}`}>
                              {item.name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">{item.quantity}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeToBuy(item.id)}
                          className="p-2 text-slate-600 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {toBuyList.some(i => i.purchased) && (
                    <div className="px-4 pb-4 pt-2 flex justify-end">
                      <button 
                        onClick={clearCompleted}
                        className="text-[10px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                      >
                        Clear Completed Items
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <ShoppingBag className="absolute right-[-40px] top-[-40px] w-64 h-64 text-white/5 -rotate-12" />
      </div>

      <div className="relative">
        {/* Toggle/Segment Section for Current Week & Following Week */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-emerald-500 rounded-full" />
            <h3 className="text-xl font-bold text-slate-800">Ingredients from Weekly Plan</h3>
          </div>
          
          <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 items-center self-center sm:self-auto shadow-inner border border-slate-200">
            <button
              onClick={() => setActiveWeekTab('current')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                activeWeekTab === 'current'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Current 
            </button>
            <button
              onClick={() => setActiveWeekTab('following')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                activeWeekTab === 'following'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveWeekTab('both')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                activeWeekTab === 'both'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Both
            </button>
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(category => (
              <div key={category} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-[0.2em]">{category}</h3>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg font-bold text-slate-500">
                    {aggregatedIngredients[category].length} items
                  </span>
                </div>
                <div className="divide-y divide-slate-50 flex-1">
                  {aggregatedIngredients[category].map((ing, idx) => (
                    <div key={idx} className="px-6 py-5 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-bold text-sm">{ing.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{ing.quantity}</span>
                      </div>
                      <button 
                        onClick={() => handleAddToBuy(ing)}
                        title="Add to Buy List"
                        className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-200 shadow-sm max-w-lg mx-auto w-full">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <ShoppingBag className="w-6 h-6 text-slate-300" />
            </div>
            
            {activeWeekTab === 'current' && (
              <>
                <h4 className="text-slate-700 font-bold text-sm mb-1">No plan generated for this week</h4>
                <p className="text-slate-400 text-xs px-6">
                  Go to the Weekly Planner and generate a meal plan for <strong className="font-semibold text-slate-500">{currentWeekIdStr}</strong> to automatically see recommended ingredients here.
                </p>
              </>
            )}

            {activeWeekTab === 'following' && (
              <>
                <h4 className="text-slate-700 font-bold text-sm mb-1">No plan generated for following week</h4>
                <p className="text-slate-400 text-xs px-6">
                  Go to the Weekly Planner and generate a meal plan for <strong className="font-semibold text-slate-500">{followingWeekIdStr}</strong> to automatically see recommended ingredients here.
                </p>
              </>
            )}

            {activeWeekTab === 'both' && (
              <>
                <h4 className="text-slate-700 font-bold text-sm mb-1">No weekly plans active</h4>
                <p className="text-slate-400 text-xs px-6">
                  Generate meal plans for the current or following weeks in the Weekly Planner to see recommended ingredients.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Manual Custom Ingredient Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden w-full max-w-md p-8 z-50 border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Add Item Manually</h3>
                  <p className="text-slate-400 text-xs font-medium mt-1">Add details of any product you wish to buy</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCustomAddSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Product Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Avocado, Almond Milk, Napkins"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Quantity / Size
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2 bags, 500g, 1L"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Category
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-bold"
                    >
                      {customCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-emerald-900/10 transition-colors"
                  >
                    Add Item
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}