import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, ChevronRight, CheckCircle2, Circle, Plus, Trash2, Share2, Copy, Check } from 'lucide-react';
import { Dish, WeeklyPlan, Ingredient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

interface ShoppingListProps {
  groupId: string;
  plan: WeeklyPlan | null;
  dishes: Dish[];
}

interface ToBuyItem extends Ingredient {
  id: string;
  _id?: string;
  purchased: boolean;
}

export default function ShoppingList({ groupId, plan, dishes }: ShoppingListProps) {
  const [toBuyList, setToBuyList] = useState<ToBuyItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

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

  if (!plan) return (
    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ShoppingBag className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-400 font-medium">Generate a meal plan first to see your shopping list.</p>
    </div>
  );

  const aggregatedIngredients: Record<string, Ingredient[]> = {};
  
  Object.values(plan.days).forEach(day => {
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
              <h2 className="text-4xl font-bold mb-2">My Shopping List</h2>
              <p className="text-slate-400 text-sm font-medium">Items you need to buy for your plan</p>
            </div>
            {toBuyList.length > 0 && (
              <button 
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl transition-all font-bold text-sm shadow-xl shadow-emerald-900/20"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Copied to Clipboard' : 'Share List'}
              </button>
            )}
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
                  Your "To Buy" list is empty. Add items from the suggestions below!
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-emerald-500 rounded-full" />
          <h3 className="text-xl font-bold text-slate-800">Ingredients from Weekly Plan</h3>
        </div>

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
      </div>

      {categories.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <ShoppingBag className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-slate-400 font-bold">Your plan seems empty. Add dishes to your plan to see aggregated ingredients.</p>
        </div>
      )}
    </div>
  );
}
