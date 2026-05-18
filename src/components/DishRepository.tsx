import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Clock, UtensilsCrossed, Search, ChefHat, Wand2, BookOpen, Archive, ArrowRightCircle } from 'lucide-react';
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
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vaultSearchTerm, setVaultSearchTerm] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [isFixing, setIsFixing] = useState<string | null>(null);

  const [newDish, setNewDish] = useState<Partial<Dish>>({
    name: '',
    category: 'Main Course',
    prepTime: 30,
    ingredients: [],
    suitableForLunch: true,
    suitableForDinner: true,
    isRegular: true
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
      setIsFixing(dish.id || (dish as any)._id);
      
      const enrichedData = await enrichDishData(dish);
      
      const updatedDish = {
        ...dish,
        category: (!dish.category || dish.category === "null") 
          ? (enrichedData.category || 'Other') 
          : dish.category,
        ingredients: (enrichedData.ingredients && enrichedData.ingredients.length > 0) ? enrichedData.ingredients : dish.ingredients,
        suitableForLunch: enrichedData.suitableForLunch ?? dish.suitableForLunch,
        suitableForDinner: enrichedData.suitableForDinner ?? dish.suitableForDinner
      };

      const id = dish.id || (dish as any)._id;
      const res = await apiFetch(`/api/groups/${groupId}/dishes/${id}`, {
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

  const handleSaveDish = async (dishToSave: Partial<Dish> = newDish) => {
    if (!dishToSave.name) return;
    try {
      const isEditing = !!dishToSave.id;
      const url = isEditing 
        ? `/api/groups/${groupId}/dishes/${dishToSave.id}` 
        : `/api/groups/${groupId}/dishes`;
      
      const response = await apiFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dishToSave),
      });

      if (response.ok) {
        setIsAdding(false);
        setNewDish({ 
          name: '', 
          category: 'Main Course', 
          prepTime: 30, 
          ingredients: [], 
          isRegular: true,
          suitableForLunch: true,
          suitableForDinner: true
        });
        onDishesUpdate();
      } else {
        const errorData = await response.json().catch(() => null);
        alert(`Failed to save dish: ${errorData?.details || errorData?.error || response.statusText}`);
      }
    } catch (error) {
       console.error("Save failed", error);
       alert("Failed to save dish");
    }
  };

  const toggleRegularStatus = async (dish: Dish) => {
    const updatedDish = { ...dish, isRegular: !dish.isRegular };
    const id = dish.id || (dish as any)._id;
    
    try {
      const response = await apiFetch(`/api/groups/${groupId}/dishes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDish),
      });

      if (response.ok) {
        onDishesUpdate();
      }
    } catch (error) {
      console.error("Failed to toggle regular status:", error);
    }
  };

  const handleDeleteDish = async (dishId: string) => {
    if (!dishId) return;
    if (!window.confirm("Delete this dish?")) return;
    try {
      const res = await apiFetch(`/api/dishes/${dishId}`, { method: 'DELETE' });
      if (res.ok) onDishesUpdate();
    } catch (error) { console.error(error); }
  };

  const filteredDishes = dishes.filter(d => 
    (d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.category && d.category.toLowerCase().includes(searchTerm.toLowerCase()))) &&
    d.isRegular !== false
  );

  const filteredStoredDishes = dishes.filter(d => 
    d.isRegular === false &&
    (d.name.toLowerCase().includes(vaultSearchTerm.toLowerCase()) ||
    (d.category && d.category.toLowerCase().includes(vaultSearchTerm.toLowerCase())))
  );

  const totalStoredCount = dishes.filter(d => d.isRegular === false).length;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search regular dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <button 
            onClick={() => setIsVaultOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-xs hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm group"
          >
            <Archive className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
            Recipe Vault
            <span className="ml-1 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] group-hover:bg-indigo-50 group-hover:text-indigo-600">{totalStoredCount}</span>
          </button>
        </div>
        <button 
          onClick={() => {
            setNewDish({ name: '', category: 'Main Course', prepTime: 30, ingredients: [], suitableForLunch: true, suitableForDinner: true, isRegular: true });
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
                key={dish.id || (dish as any)._id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => { setNewDish(dish); setIsAdding(true); }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex flex-col cursor-pointer border-b-4 border-b-slate-100"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${(!dish.category || dish.category === 'null') ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      {(!dish.category || dish.category === 'null') ? 'Missing Category' : dish.category}
                    </span>
                    {/* <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRegularStatus(dish);
                      }}
                      className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-colors"
                      title="Move to Recipe Vault"
                    >
                      Regular
                    </button> */}
                  </div>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleDeleteDish(dish.id || (dish as any)._id); 
                    }} 
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 line-clamp-2 leading-tight">{dish.name}</h3>
                
                {needsFix && (
                  <button 
                    onClick={(e) => handleFixDish(e, dish)}
                    disabled={isFixing === (dish.id || (dish as any)._id)}
                    className="mb-4 flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 py-2 rounded-xl hover:bg-emerald-100 transition-all"
                  >
                    <Wand2 className={`w-3 h-3 ${isFixing === (dish.id || (dish as any)._id) ? 'animate-spin' : ''}`} />
                    {isFixing === (dish.id || (dish as any)._id) ? 'Fixing...' : 'Magic Fix Data'}
                  </button>
                )}

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
                    {dish.ingredients.length} INGREDIENTES
                  </div>
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
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800">{newDish.id ? 'Edit Dish' : 'Add New Dish'}</h2>
                  <button 
                    onClick={() => setIsVaultOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
                  >
                    <BookOpen className="w-3 h-3" /> Browse Vault
                  </button>
                </div>
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
                  <div className="flex justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dish Name</label>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Regular Dish</span>
                       <button 
                        onClick={() => setNewDish({ ...newDish, isRegular: !newDish.isRegular })}
                        className={`w-8 h-4 rounded-full p-0.5 transition-all ${newDish.isRegular ? 'bg-emerald-500' : 'bg-slate-200'}`}
                       >
                         <div className={`w-3 h-3 bg-white rounded-full transition-all ${newDish.isRegular ? 'ml-4' : 'ml-0'}`} />
                       </button>
                    </div>
                  </div>
                  <input type="text" value={newDish.name} onChange={(e) => setNewDish({...newDish, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Category</label>
                    <input list="cats" value={newDish.category === 'null' ? '' : newDish.category} onChange={(e) => setNewDish({...newDish, category: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    <datalist id="cats">{['Main Course', 'Pasta', 'Salads', 'Soups', 'Asian', 'Legumbres'].map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Time (min)</label>
                    <input type="number" value={newDish.prepTime} onChange={(e) => setNewDish({...newDish, prepTime: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ingredients</label>
                  <div className="space-y-2">
                    {newDish.ingredients?.map((ing, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{ing.name} <span className="text-slate-400 font-normal">({ing.quantity})</span></p>
                          <p className={`text-[9px] font-bold uppercase tracking-wider ${(!ing.category || ing.category === 'null') ? 'text-rose-500' : 'text-emerald-600'}`}>{(!ing.category || ing.category === 'null') ? 'Missing Category' : ing.category}</p>
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
                <button onClick={() => handleSaveDish()} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-lg shadow-slate-200">Save Dish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipe Vault Modal */}
      <AnimatePresence>
        {isVaultOpen && (
          <motion.div 
            key="vault-modal"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsVaultOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden h-[80vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/80">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Recipe Vault</h2>
                  <p className="text-slate-400 text-sm font-medium">Stored recipes available to become regular dishes</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search vault..."
                      value={vaultSearchTerm}
                      onChange={(e) => setVaultSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setIsVaultOpen(false);
                      setVaultSearchTerm('');
                    }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {totalStoredCount === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center">
                      <Archive className="w-10 h-10 text-slate-200" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-400">Vault is Empty</h3>
                      <p className="text-slate-300 text-sm">Move dishes here to clean up your regular repository</p>
                    </div>
                  </div>
                ) : filteredStoredDishes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center">
                      <Search className="w-10 h-10 text-slate-200" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-400">No results found</h3>
                      <p className="text-slate-300 text-sm">Try adjusting your search terms</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredStoredDishes.map(dish => (
                      <motion.div 
                        key={dish.id || (dish as any)._id}
                        layout
                        className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center gap-4 hover:border-indigo-200 hover:shadow-lg transition-all group"
                      >
                        {/* <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
                           <BookOpen className="w-6 h-6" />
                        </div> */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-700">{dish.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{dish.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                            onClick={() => toggleRegularStatus(dish)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                           >
                             Promote to Regular
                             <ArrowRightCircle className="w-3.5 h-3.5" />
                           </button>
                           <button 
                            onClick={() => {
                              const id = (dish as any)._id || dish.id;
                              handleDeleteDish(id);
                            }}
                            className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                 <button 
                  onClick={() => {
                    setNewDish({ 
                      name: '', 
                      category: 'Main Course', 
                      prepTime: 30, 
                      ingredients: [],
                      suitableForLunch: true,
                      suitableForDinner: true,
                      isRegular: false
                    });
                    setIsVaultOpen(false);
                    setIsAdding(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all shadow-xl shadow-slate-200"
                 >
                   <Plus className="w-5 h-5" />
                   Add New Recipe to Vault
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
