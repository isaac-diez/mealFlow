import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Clock, UtensilsCrossed, Search, ChefHat } from 'lucide-react';
import { Dish, Ingredient } from '../types';
import { suggestNewDish } from '../services/aiService';
import { apiFetch } from '../lib/api';

interface DishRepositoryProps {
  groupId: string;
  dishes: Dish[];
  onDishesUpdate: () => void;
}

export default function DishRepository({ groupId, dishes, onDishesUpdate }: DishRepositoryProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  const [newDish, setNewDish] = useState<Partial<Dish>>({
    name: '',
    category: 'Main Course',
    prepTime: 30,
    ingredients: [],
    suitableForLunch: true,
    suitableForDinner: true
  });

  const [newIngredient, setNewIngredient] = useState<Ingredient>({
    name: '',
    quantity: '',
    category: 'Other'
  });

  const categories = Array.from(new Set(dishes.map(d => d.category)));

  const handleSaveDish = async () => {
    if (!newDish.name) return;
    
    try {
      const isEditing = !!newDish.id;
      const url = isEditing 
        ? `/api/groups/${groupId}/dishes/${newDish.id}` 
        : `/api/groups/${groupId}/dishes`;
      
      const response = await apiFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDish),
      });

      if (response.ok) {
        setIsAdding(false);
        setNewDish({ name: '', category: 'Main Course', prepTime: 30, ingredients: [] });
        onDishesUpdate();
      } else {
        const errorData = await response.json().catch(() => null);
        alert(`Failed to save dish: ${errorData?.details || errorData?.error || response.statusText}`);
      }
    } catch (error) {
       console.error("Failed to save dish:", error);
       alert("Failed to save dish");
    }
  };

  const handleAiSuggest = async () => {
    setSuggesting(true);
    try {
      const existingDishNames = dishes.map(d => d.name);
      const suggestion = await suggestNewDish(existingDishNames);
      setNewDish(prev => ({ ...prev, ...suggestion }));
    } catch (error) {
      console.error(error);
    } finally {
      setSuggesting(false);
    }
  };

  const handleDeleteDish = async (dishId: string) => {
    if (!dishId) {
      window.alert("ERROR: No Dish ID provided for deletion!");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete this dish?\nID: ${dishId}`)) return;
    
    window.alert(`[DEBUG] Attempting to delete dish ID: ${dishId}`);
    try {
      const response = await apiFetch(`/api/dishes/${dishId}`, {
        method: 'DELETE'
      });
      
      const responseData = await response.json().catch(() => ({ error: "Could not parse JSON response" }));
      
      if (response.ok) {
        window.alert("SUCCESS: Dish deleted from database.");
        onDishesUpdate();
      } else {
        window.alert(`FAILED: Server returned ${response.status}\nError: ${responseData.error || responseData.details || "Unknown error"}`);
      }
    } catch (error: any) {
       window.alert(`CRITICAL ERROR: Failed to even send the delete request!\nMessage: ${error.message}`);
    }
  };

  const filteredDishes = dishes.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button 
          onClick={() => {
            setNewDish({ 
              name: '', 
              category: 'Main Course', 
              prepTime: 30, 
              ingredients: [],
              suitableForLunch: true,
              suitableForDinner: true
            });
            setIsAdding(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-4 h-4" />
          Add New Dish
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredDishes.map(dish => (
            <motion.div 
              key={dish.id || (dish as any)._id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => {
                setNewDish(dish);
                setIsAdding(true);
              }}
              className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex flex-col cursor-pointer border-b-4 border-b-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                  {dish.category}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = (dish as any)._id || dish.id;
                    if (!id) {
                      window.alert("CRITICAL ERROR: This dish object has neither 'id' nor '_id' property!\nObject: " + JSON.stringify(dish));
                      return;
                    }
                    handleDeleteDish(id);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all z-20"
                  title="Delete Dish"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 line-clamp-2 leading-tight">{dish.name}</h3>
              <div className="mt-auto flex items-center gap-5 text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  {dish.prepTime}m
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  {dish.ingredients.length} Items
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Dish Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            key="add-dish-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-800">{newDish.id ? 'Edit Dish' : 'Add New Dish'}</h2>
                <button 
                  onClick={handleAiSuggest}
                  disabled={suggesting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                >
                  <ChefHat className={`w-3.5 h-3.5 ${suggesting ? 'animate-bounce' : ''}`} />
                  {suggesting ? 'Thinking...' : 'AI SuggestION'}
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dish Name</label>
                  <input 
                    type="text" 
                    value={newDish.name || ''}
                    onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                    placeholder="e.g., Miso Ramen"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Category</label>
                    <input 
                      list="dish-categories"
                      value={newDish.category || ''}
                      onChange={(e) => setNewDish({ ...newDish, category: e.target.value })}
                      placeholder="Select or type category"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
                    />
                    <datalist id="dish-categories">
                      {Array.from(new Set([...dishes.map(d => d.category), 'Pasta', 'Salads', 'Soups', 'Asian', 'Main Course'])).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Prep Time (min)</label>
                    <input 
                      type="number" 
                      value={newDish.prepTime || 0}
                      onChange={(e) => setNewDish({ ...newDish, prepTime: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={!!newDish.suitableForLunch}
                      onChange={(e) => setNewDish({ ...newDish, suitableForLunch: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Suitable for Lunch</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={!!newDish.suitableForDinner}
                      onChange={(e) => setNewDish({ ...newDish, suitableForDinner: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Suitable for Dinner</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ingredients</label>
                  <div className="space-y-2">
                    {newDish.ingredients?.map((ing, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-700 font-bold">{ing.name} <span className="text-slate-400 font-normal ml-1">({ing.quantity})</span></span>
                          <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">{ing.category}</span>
                        </div>
                        <button 
                          onClick={() => setNewDish({
                            ...newDish,
                            ingredients: newDish.ingredients?.filter((_, i) => i !== idx)
                          })}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Ingredient name" 
                          className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
                          value={newIngredient.name || ''}
                          onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                        />
                        <input 
                          type="text" 
                          placeholder="Qty" 
                          className="w-20 px-3 py-2 text-sm bg-transparent border-l border-slate-200 focus:outline-none"
                          value={newIngredient.quantity || ''}
                          onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-2 items-center border-t border-slate-100 pt-2 px-2 pb-1">
                    <input 
                      list="ingredient-categories"
                      value={newIngredient.category || ''}
                      onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value })}
                      placeholder="Select or type ingredient"
                      className="flex-1 bg-transparent text-xs font-bold text-slate-500 focus:outline-none"
                    />
                    <datalist id="ingredient-categories">
                      {Array.from(new Set([...dishes.map(d => d.ingredients?.map(i => i.category)).flat(), 'Vegetables', 'Proteins', 'Dairy/Eggs', 'Pantry', 'Fruits', 'Bakery', 'Other'])).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </datalist>

                      <button 
                        onClick={() => {
                          if (newIngredient.name) {
                            setNewDish({ ...newDish, ingredients: [...(newDish.ingredients || []), newIngredient] });
                            setNewIngredient({ name: '', quantity: '', category: 'Other' });
                          }
                        }}
                        className="p-1 px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 px-4 py-3 text-slate-500 font-bold text-sm bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveDish}
                  className="flex-1 px-4 py-3 bg-slate-900 text-white font-bold text-sm rounded-2xl shadow-xl shadow-slate-200 hover:bg-black transition-all"
                >
                  Save Dish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
