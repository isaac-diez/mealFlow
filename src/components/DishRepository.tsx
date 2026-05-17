import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Clock, UtensilsCrossed, Search, ChefHat, Wand2 } from 'lucide-react';
import { Dish, Ingredient } from '../types';
import { suggestNewDish, enrichDishData } from '../services/aiService';
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
  const [isFixing, setIsFixing] = useState<string | null>(null);

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

  // --- LOGIC HANDLERS ---

  const handleFixDish = async (e: React.MouseEvent, dish: Dish) => {
    e.stopPropagation(); 
    try {
      setIsFixing(dish.id);
      
      // AI now assesses Categories AND Suitability (Lunch/Dinner)
      const enrichedData = await enrichDishData(dish);
      
      const updatedDish = {
        ...dish,
        category: (!dish.category || dish.category === "null") 
          ? (enrichedData.category || 'Other') 
          : dish.category,
        ingredients: enrichedData.ingredients || dish.ingredients,
        // Update suitability from AI assessment
        suitableForLunch: enrichedData.suitableForLunch ?? dish.suitableForLunch,
        suitableForDinner: enrichedData.suitableForDinner ?? dish.suitableForDinner
      };

      // URL FIX: Include groupId to match backend route expectations
      const res = await apiFetch(`/api/groups/${groupId}/dishes/${dish.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDish),
      });

      if (res.ok) onDishesUpdate();
    } catch (err) {
      console.error(err);
      alert("Magic Fix failed.");
    } finally {
      setIsFixing(null);
    }
  };

  const handleSaveDish = async () => {
    if (!newDish.name) return;
    try {
      const isEditing = !!newDish.id;
      // URL FIX: Manual save also needs the groupId path
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
        onDishesUpdate();
      } else {
        alert(`Failed to save: ${response.status}`);
      }
    } catch (error) {
       console.error("Save failed", error);
    }
  };

  const handleDeleteDish = async (id: string) => {
    if (!window.confirm("Delete this dish?")) return;
    try {
      // Note: If DELETE /api/dishes/:id works, leave it. 
      // If it fails with 404, change it to /api/groups/${groupId}/dishes/${id}
      const res = await apiFetch(`/api/dishes/${id}`, { method: 'DELETE' });
      if (res.ok) onDishesUpdate();
    } catch (error) { console.error(error); }
  };

  const filteredDishes = dishes.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.category && d.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <button 
          onClick={() => {
            setNewDish({ name: '', category: 'Main Course', prepTime: 30, ingredients: [], suitableForLunch: true, suitableForDinner: true });
            setIsAdding(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-4 h-4" /> Add New Dish
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredDishes.map(dish => {
            const needsFix = !dish.category || 
                            dish.category === "null" || 
                            dish.ingredients?.some(i => !i.category || i.category === "null" || i.category === "");

            return (
              <motion.div 
                key={dish.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { setNewDish(dish); setIsAdding(true); }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${(!dish.category || dish.category === 'null') ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {(!dish.category || dish.category === 'null') ? 'Missing Category' : dish.category}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDish(dish.id); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{dish.name}</h3>
                
                {needsFix && (
                  <button 
                    onClick={(e) => handleFixDish(e, dish)}
                    disabled={isFixing === dish.id}
                    className="mb-4 flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 py-2 rounded-xl hover:bg-emerald-100 transition-all"
                  >
                    <Wand2 className={`w-3 h-3 ${isFixing === dish.id ? 'animate-spin' : ''}`} />
                    {isFixing === dish.id ? 'Fixing...' : 'Magic Fix Data'}
                  </button>
                )}

                <div className="mt-auto flex items-center gap-4 text-[11px] text-slate-400 font-bold uppercase">
                  <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{dish.prepTime}m</div>
                  <div className="flex items-center gap-1"><UtensilsCrossed className="w-3.5 h-3.5" />{dish.ingredients.length} Items</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-800">{newDish.id ? 'Edit Dish' : 'Add New Dish'}</h2>
                <button onClick={async () => {
                   setSuggesting(true);
                   try {
                     const sug = await suggestNewDish(dishes.map(d => d.name));
                     setNewDish(prev => ({ ...prev, ...sug }));
                   } finally { setSuggesting(false); }
                }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">
                  <ChefHat className={`w-3.5 h-3.5 ${suggesting ? 'animate-bounce' : ''}`} /> {suggesting ? 'Thinking...' : 'AI Suggest'}
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dish Name</label>
                  <input type="text" value={newDish.name} onChange={(e) => setNewDish({...newDish, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                    <input list="cats" value={newDish.category === 'null' ? '' : newDish.category} onChange={(e) => setNewDish({...newDish, category: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none" />
                    <datalist id="cats">{['Main Course', 'Pasta', 'Salads', 'Soups', 'Asian', 'Legumbres'].map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time (min)</label>
                    <input type="number" value={newDish.prepTime} onChange={(e) => setNewDish({...newDish, prepTime: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none" />
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {['suitableForLunch', 'suitableForDinner'].map(key => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={!!(newDish as any)[key]} onChange={(e) => setNewDish({...newDish, [key]: e.target.checked})} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-tight group-hover:text-slate-900">{key.replace('suitableFor', '')}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingredients</label>
                  <div className="space-y-2">
                    {newDish.ingredients?.map((ing, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{ing.name} <span className="text-slate-400 font-normal">({ing.quantity})</span></p>
                          <p className={`text-[9px] font-bold uppercase ${(!ing.category || ing.category === 'null') ? 'text-rose-500' : 'text-emerald-600'}`}>{(!ing.category || ing.category === 'null') ? 'Missing Category' : ing.category}</p>
                        </div>
                        <button onClick={() => setNewDish({...newDish, ingredients: newDish.ingredients?.filter((_, i) => i !== idx)})} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex gap-2">
                      <input placeholder="Name" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={newIngredient.name} onChange={e => setNewIngredient({...newIngredient, name: e.target.value})} />
                      <input placeholder="Qty" className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={newIngredient.quantity} onChange={e => setNewIngredient({...newIngredient, quantity: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <input list="ing-cats" placeholder="Category" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={newIngredient.category} onChange={e => setNewIngredient({...newIngredient, category: e.target.value})} />
                      <datalist id="ing-cats">{['Vegetables', 'Proteins', 'Dairy', 'Pantry', 'Legumbres', 'Especias'].map(c => <option key={c} value={c} />)}</datalist>
                      <button onClick={() => {
                        if (newIngredient.name) {
                          setNewDish({...newDish, ingredients: [...(newDish.ingredients || []), newIngredient]});
                          setNewIngredient({name: '', quantity: '', category: 'Other'});
                        }
                      }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">Add</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex gap-3 mt-auto border-t border-slate-100">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition-colors">Cancel</button>
                <button onClick={handleSaveDish} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-lg">Save Dish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}