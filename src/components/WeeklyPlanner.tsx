import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Wand2, Share2, ShoppingBag, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Dish, WeeklyPlan, DayPlan } from '../types';
import { generateWeeklyMenu } from '../services/aiService';
import { apiFetch } from '../lib/api';

interface WeeklyPlannerProps {
  groupId: string;
  dishes: Dish[];
  onPlanUpdate?: () => void;
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onLoadingChange?: (loading: boolean) => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function WeeklyPlanner({ 
  groupId, 
  dishes, 
  onPlanUpdate, 
  currentWeek, 
  onWeekChange,
  onLoadingChange 
}: WeeklyPlannerProps) {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectingSlot, setSelectingSlot] = useState<{ day: string; slot: 'lunch' | 'dinner' } | null>(null);

  useEffect(() => {
    if (onLoadingChange) onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    const handleTrigger = () => handleAiGenerate();
    window.addEventListener('trigger-ai-generate', handleTrigger);
    return () => window.removeEventListener('trigger-ai-generate', handleTrigger);
  }, [dishes, plans, currentWeek]); // Dependencies for generation

  const getWeekId = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  };

  const currentWeekId = getWeekId(currentWeek);
  const currentPlan = plans.find(p => p.weekId === currentWeekId);

  useEffect(() => {
    fetchPlans();
  }, [groupId]);

  const fetchPlans = async () => {
    if (!groupId) return;
    try {
      const res = await apiFetch(`/api/groups/${groupId}/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
        if (onPlanUpdate) onPlanUpdate();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const ensurePlanExists = async (): Promise<WeeklyPlan | null> => {
    if (!groupId) return null;
    if (currentPlan) return currentPlan;
    const blankDays = DAYS.reduce((acc, day) => {
      acc[day] = { lunch: { dishIds: [] }, dinner: { dishIds: [] } };
      return acc;
    }, {} as any);
    const newPlan = { groupId, weekId: currentWeekId, days: blankDays };
    
    const res = await apiFetch(`/api/groups/${groupId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPlan)
    });
    if (res.ok) {
      const createdPlan = await res.json();
      setPlans(prev => [...prev, createdPlan]);
      return createdPlan;
    }
    return null;
  };

  const handleSlotClick = async (day: string, slot: 'lunch' | 'dinner') => {
    if (!groupId) return;
    await ensurePlanExists();
    setSelectingSlot({ day, slot });
  };

  const handleSelectDish = async (dishId: string) => {
    if (!selectingSlot) return;
    const { day, slot } = selectingSlot;
    
    const activePlan = plans.find(p => p.weekId === currentWeekId);
    if (!activePlan) return;

    const currentSlot = activePlan.days[day as keyof WeeklyPlan['days']][slot];
    const dishIds = currentSlot.dishIds || [];
    const isSelected = dishIds.includes(dishId);
    
    let updatedDishIds;
    if (isSelected) {
      updatedDishIds = dishIds.filter(id => id !== dishId);
    } else {
      updatedDishIds = [...dishIds, dishId];
    }

    const updatedPlan = {
      ...activePlan,
      days: {
        ...activePlan.days,
        [day]: {
          ...activePlan.days[day as keyof WeeklyPlan['days']],
          [slot]: { dishIds: updatedDishIds }
        }
      }
    };

    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    // Don't close modal, allow multiple selection
  };

  const handleClearSlot = async () => {
    if (!selectingSlot) return;
    const { day, slot } = selectingSlot;
    const activePlan = plans.find(p => p.weekId === currentWeekId);
    if (!activePlan) return;

    const updatedPlan = {
      ...activePlan,
      days: {
        ...activePlan.days,
        [day]: {
          ...activePlan.days[day as keyof WeeklyPlan['days']],
          [slot]: { dishIds: [] }
        }
      }
    };

    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  const handleSavePlan = async () => {
    const activePlan = plans.find(p => p.weekId === currentWeekId);
    if (!activePlan) return;

    await apiFetch(`/api/plans/${activePlan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activePlan)
    });
    setSelectingSlot(null);
  };
  const handleWeekChange = (direction: number) => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    onWeekChange(newDate);
  };

  const handleAiGenerate = async () => {
    if (dishes.length < 5) {
      alert("Please add at least 5 dishes to your repository first!");
      return;
    }
    setLoading(true);
    try {
      const prevWeekDate = new Date(currentWeek);
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeekId = getWeekId(prevWeekDate);
      const previousPlan = plans.find(p => p.weekId === prevWeekId) || null;

      const generatedDays = await generateWeeklyMenu(dishes, previousPlan);
      
      const newPlan: Omit<WeeklyPlan, 'id'> = {
        groupId,
        weekId: currentWeekId,
        days: generatedDays as WeeklyPlan['days']
      };

      if (currentPlan) {
        await apiFetch(`/api/plans/${currentPlan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPlan)
        });
      } else {
        await apiFetch(`/api/groups/${groupId}/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPlan)
        });
      }
      fetchPlans();
    } catch (error) {
      console.error(error);
      alert("AI Generation failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (format: 'whatsapp' | 'email') => {
    if (!currentPlan) return;

    let text = `📅 Meal Plan for ${currentWeekId}\n\n`;
    DAYS.forEach(day => {
      const dayPlan = currentPlan.days[day as keyof WeeklyPlan['days']];
      const lunchDishesNames = dayPlan.lunch.dishIds.map(id => dishes.find(d => d.id === id)?.name || '---').join(', ');
      const dinnerDishesNames = dayPlan.dinner.dishIds.map(id => dishes.find(d => d.id === id)?.name || '---').join(', ');
      text += `*${day.toUpperCase()}*\n`;
      text += `Lunch: ${lunchDishesNames || '---'}\n`;
      text += `Dinner: ${dinnerDishesNames || '---'}\n\n`;
    });

    if (format === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.location.href = `mailto:?subject=Weekly Meal Plan&body=${encodeURIComponent(text)}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
          <button 
            onClick={() => handleWeekChange(-1)}
            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[140px]">
            <h2 className="font-bold text-slate-800 text-sm">Week {currentWeekId.split('-W')[1]}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{currentWeekId.split('-W')[0]}</p>
          </div>
          <button 
            onClick={() => handleWeekChange(1)}
            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar"
      >
        <div className="flex gap-4 min-w-[1000px]">
          {DAYS.map(day => (
            <motion.div 
              key={day}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 min-w-[180px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className={`font-bold text-sm capitalize ${day === 'sunday' ? 'text-rose-500' : 'text-slate-500'}`}>{day.slice(0, 3)}</h3>
              </div>
              <div className="p-3 space-y-3 flex-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-2">Lunch</span>
                  <div 
                    onClick={() => handleSlotClick(day, 'lunch')}
                    className={`min-h-[90px] rounded-2xl p-3 flex flex-col items-start justify-center cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all ${currentPlan?.days[day]?.lunch?.dishIds?.length ? 'bg-emerald-50 border border-emerald-100' : 'border-2 border-dashed border-slate-100 flex items-center justify-center'}`}
                  >
                    {currentPlan?.days[day]?.lunch?.dishIds?.map((id: string) => {
                      const dish = dishes.find(d => (d.id === id || (d as any)._id === id));
                      return dish ? (
                        <div key={id} className="mb-2 last:mb-0 w-full">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {dish.name}
                          </p>
                          <p className="text-[9px] text-emerald-600 font-bold mt-0.5 uppercase">
                            {dish.category}
                          </p>
                        </div>
                      ) : null;
                    })}
                    {!currentPlan?.days[day]?.lunch?.dishIds?.length && (
                      <span className="text-lg text-slate-200">+</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest px-2">Dinner</span>
                  <div 
                    onClick={() => handleSlotClick(day, 'dinner')}
                    className={`min-h-[90px] rounded-2xl p-3 flex flex-col items-start justify-center cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all ${currentPlan?.days[day]?.dinner?.dishIds?.length ? 'bg-indigo-50 border border-indigo-100' : 'border-2 border-dashed border-slate-100 flex items-center justify-center'}`}
                  >
                    {currentPlan?.days[day]?.dinner?.dishIds?.map((id: string) => {
                      const dish = dishes.find(d => (d.id === id || (d as any)._id === id));
                      return dish ? (
                        <div key={id} className="mb-2 last:mb-0 w-full">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {dish.name}
                          </p>
                          <p className="text-[9px] text-indigo-600 font-bold mt-0.5 uppercase">
                            {dish.category}
                          </p>
                        </div>
                      ) : null;
                    })}
                    {!currentPlan?.days[day]?.dinner?.dishIds?.length && (
                      <span className="text-lg text-slate-200">+</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {!currentPlan && !loading && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Wand2 className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-slate-400 font-bold">No plan for this week yet.</p>
          <button 
            onClick={handleAiGenerate}
            className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95"
          >
            Auto-Generate with AI
          </button>
        </div>
      )}
      {/* Dish Selection Modal */}
      <AnimatePresence>
        {selectingSlot && (
          <motion.div 
            key="dish-select-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectingSlot(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 flex flex-col max-h-[80vh]"
            >
              <h2 className="text-xl font-bold text-slate-800 mb-2">Select Dish</h2>
              <p className="text-sm font-medium text-slate-500 mb-4 capitalize">
                {selectingSlot.day} - {selectingSlot.slot}
              </p>
              
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2 mb-4">
                <button
                  onClick={handleClearSlot}
                  className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50 transition-all group flex items-center justify-between"
                >
                  <span className="font-bold text-slate-700 group-hover:text-rose-600">Clear Slot</span>
                  <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                </button>
                {dishes
                  .filter(d => selectingSlot.slot === 'lunch' ? d.suitableForLunch : d.suitableForDinner)
                  .map(dish => {
                    const slotData = currentPlan?.days[selectingSlot.day as keyof WeeklyPlan['days']][selectingSlot.slot];
                    const dishIds = slotData?.dishIds || [];
                    const isSelected = dishIds.includes(dish.id);
                    return (
                      <button
                        key={dish.id}
                        onClick={() => handleSelectDish(dish.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50'}`}
                      >
                        <div>
                          <p className={`font-bold text-sm ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>{dish.name}</p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 mt-1">{dish.category}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      </button>
                    );
                  })}
                {dishes.length === 0 && (
                  <div className="p-6 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl">
                    No dishes available. Add some in your repository first.
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectingSlot(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSavePlan}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
