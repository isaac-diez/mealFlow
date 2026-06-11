import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Wand2, Share2, ShoppingBag, Plus, Trash2, CheckCircle2, GripVertical, X } from 'lucide-react';
import { Dish, WeeklyPlan, DayPlan } from '../types';
import { generateWeeklyMenu } from '../services/aiService';
import { apiFetch } from '../lib/api';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  MouseSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core';

interface WeeklyPlannerProps {
  groupId: string;
  dishes: Dish[];
  onPlanUpdate?: () => void;
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onLoadingChange?: (loading: boolean) => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

interface DroppableSlotProps {
  day: string;
  slot: 'lunch' | 'dinner';
  dishIds: string[];
  dishes: Dish[];
  onClick: () => void;
  onRemove: (dishId: string) => void;
  isDragEnabled: boolean;
}

// Droppable Slot Component
const DroppableSlot: React.FC<DroppableSlotProps> = ({ 
  day, 
  slot, 
  dishIds, 
  dishes, 
  onClick,
  onRemove,
  isDragEnabled
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `${day}-${slot}`,
    data: { day, slot }
  });

  return (
    <div className="space-y-1">
      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 ${slot === 'lunch' ? 'text-emerald-600' : 'text-indigo-600'}`}>
        {slot}
      </span>
      <div 
        ref={setNodeRef}
        onClick={onClick}
        className={`min-h-[110px] rounded-2xl p-3 flex flex-col items-start justify-start cursor-pointer transition-all border-2 ${
          isOver 
            ? 'border-emerald-500 bg-emerald-50/50 scale-[1.02] shadow-lg ring-4 ring-emerald-500/10' 
            : dishIds.length 
              ? (slot === 'lunch' ? 'bg-emerald-50 border-emerald-100 hover:ring-2 hover:ring-emerald-500/30' : 'bg-indigo-50 border-indigo-100 hover:ring-2 hover:ring-indigo-500/30')
              : 'border-dashed border-slate-100 flex items-center justify-center hover:border-slate-300'
        }`}
      >
        {dishIds.map((id: string, index: number) => {
          const dish = dishes.find(d => (d.id === id || (d as any)._id === id));
          if (!dish) return null;
          return (
            <DraggableDishItem 
              key={`${day}-${slot}-${id}-${index}`} 
              index={index}
              dish={dish} 
              slot={slot} 
              day={day} 
              onRemove={onRemove} 
              disabled={!isDragEnabled} 
            />
          );
        })}
        {!dishIds.length && (
          <span className="text-lg text-slate-200">+</span>
        )}
      </div>
    </div>
  );
};

interface DraggableDishItemProps {
  dish: Dish;
  slot: 'lunch' | 'dinner';
  day: string;
  index: number;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

// Draggable Dish Item (Inside Planner)
const DraggableDishItem: React.FC<DraggableDishItemProps> = ({ dish, slot, day, index, onRemove, disabled = false }) => {
  const id = dish.id || (dish as any)._id;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `planner-${id}-${day}-${slot}-${index}`,
    data: { dishId: id, source: 'planner', sourceDay: day, sourceSlot: slot, index },
    disabled
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : undefined,
    touchAction: 'none'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`mb-2 last:mb-0 w-full p-2 bg-white rounded-xl shadow-sm border border-slate-100 group relative ${slot === 'lunch' ? 'hover:border-emerald-200' : 'hover:border-indigo-200'} ${isDragging ? 'opacity-30 bg-slate-100 border-dashed border-slate-300' : ''}`}
    >
      <div className="flex items-center gap-2">
        {!disabled && (
          <div {...attributes} {...listeners} style={{ touchAction: 'none' }} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-300 hover:text-slate-400">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 leading-tight truncate">
            {dish.name}
          </p>
          <p className={`text-[9px] font-bold uppercase ${slot === 'lunch' ? 'text-emerald-600' : 'text-indigo-600'}`}>
            {dish.category}
          </p>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

interface DraggableDishProps {
  dish: Dish;
  disabled?: boolean;
  prefix?: string;
}

// Draggable Dish Component (From Repository)
const DraggableDish: React.FC<DraggableDishProps> = ({ dish, disabled = false, prefix = 'repo' }) => {
  const id = dish.id || (dish as any)._id;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${prefix}-${id}`,
    data: { dishId: id, source: 'repository' },
    disabled
  });

  const style = {
    transform: transform && !isDragging ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : undefined,
    touchAction: 'none' as const
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      {...(!disabled ? attributes : {})}
      {...(!disabled ? listeners : {})}
      className={`p-3 bg-white border border-slate-200 rounded-2xl shadow-sm ${isDragging ? '' : 'transition-all'} ${disabled ? 'opacity-80' : 'cursor-grab active:cursor-grabbing hover:border-emerald-500'} ${isDragging ? 'opacity-30 bg-slate-100 border-dashed border-slate-300' : ''}`}
    >
      <p className="text-xs font-bold text-slate-800 truncate">{dish.name}</p>
      <p className="text-[10px] text-slate-400 font-bold uppercase">{dish.category}</p>
    </div>
  );
};

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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 15,
      },
    })
  );

  useEffect(() => {
    if (onLoadingChange) onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    const handleTrigger = () => handleAiGenerate();
    window.addEventListener('trigger-ai-generate', handleTrigger);
    return () => window.removeEventListener('trigger-ai-generate', handleTrigger);
  }, [dishes, plans, currentWeek]);

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
    const existing = plans.find(p => p.weekId === currentWeekId);
    if (existing) return existing;

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

  const handleDragStart = (event: DragStartEvent) => {
    const dragId = event.active.id as string;
    setActiveDragId(dragId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    const dragId = active.id as string;
    setActiveDragId(null);
    if (dragId.startsWith('repo-')) {
      setIsLibraryOpen(false);
    }
    
    if (over && over.data.current) {
      const { day: targetDay, slot: targetSlot } = over.data.current as { day: string, slot: 'lunch' | 'dinner' };
      const { dishId, source, sourceDay, sourceSlot } = active.data.current as any;
      
      if (!dishId) return;

      const activePlan = await ensurePlanExists();
      if (!activePlan) return;

      // Avoid redundant drops
      if (source === 'planner' && sourceDay === targetDay && sourceSlot === targetSlot) return;

      let newDays = { ...activePlan.days };

      // If moving within planner, remove from source FIRST
      if (source === 'planner') {
         const oldSlot = newDays[sourceDay as keyof WeeklyPlan['days']][sourceSlot as 'lunch' | 'dinner'];
         newDays = {
           ...newDays,
           [sourceDay]: {
             ...newDays[sourceDay as keyof WeeklyPlan['days']],
             [sourceSlot]: { dishIds: oldSlot.dishIds.filter(id => id !== dishId) }
           }
         };
      }

      // Add to target slot
      const targetSlotData = newDays[targetDay as keyof WeeklyPlan['days']][targetSlot];
      const targetDishIds = targetSlotData.dishIds || [];
      if (!targetDishIds.includes(dishId)) {
        newDays = {
          ...newDays,
          [targetDay]: {
            ...newDays[targetDay as keyof WeeklyPlan['days']],
            [targetSlot]: { dishIds: [...targetDishIds, dishId] }
          }
        };
      }

      const updatedPlan: WeeklyPlan = { ...activePlan, days: newDays };
      setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Persist change
      await apiFetch(`/api/plans/${activePlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPlan)
      });
    }
  };

  const handleRemoveDish = async (day: string, slot: 'lunch' | 'dinner', dishId: string) => {
    if (!currentPlan) return;

    const currentSlot = currentPlan.days[day as keyof WeeklyPlan['days']][slot];
    const updatedDishIds = (currentSlot.dishIds || []).filter(id => id !== dishId);

    const updatedPlan: WeeklyPlan = {
      ...currentPlan,
      days: {
        ...currentPlan.days,
        [day]: {
          ...currentPlan.days[day as keyof WeeklyPlan['days']],
          [slot]: { dishIds: updatedDishIds }
        }
      }
    };

    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));

    await apiFetch(`/api/plans/${currentPlan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPlan)
    });
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
      const regularDishes = dishes.filter(d => d.isRegular !== false);
      if (regularDishes.length < 5) {
        alert("Please have at least 5 regular dishes in your repository for AI generation!");
        setLoading(false);
        return;
      }

      const prevWeekDate = new Date(currentWeek);
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeekId = getWeekId(prevWeekDate);
      const previousPlan = plans.find(p => p.weekId === prevWeekId) || null;

      const generatedDays = await generateWeeklyMenu(regularDishes, previousPlan);
      
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

  const filteredRepoDishes = dishes.filter(d => 
    (d.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    d.category.toLowerCase().includes(repoSearch.toLowerCase())) &&
    d.isRegular !== false
  );

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6 relative">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => handleWeekChange(-1)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-600 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[120px]">
              <h2 className="font-bold text-slate-800 text-sm">Week {currentWeekId.split('-W')[1]}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{currentWeekId.split('-W')[0]}</p>
            </div>
            <button 
              onClick={() => handleWeekChange(1)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-600 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setIsLibraryOpen(!isLibraryOpen)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${isLibraryOpen ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-600 hover:text-emerald-600'}`}
            >
              <div className={`w-4 h-4 flex items-center justify-center rounded ${isLibraryOpen ? 'bg-emerald-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                 <Plus className="w-3 h-3" />
              </div>
              Library
            </button>
            <button 
              onClick={() => setIsDragEnabled(!isDragEnabled)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${isDragEnabled ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-600 hover:text-indigo-600'}`}
            >
              <div className={`w-4 h-4 flex items-center justify-center rounded text-white ${isDragEnabled ? 'bg-indigo-400' : 'bg-slate-100 text-slate-400'}`}>
                 <GripVertical className="w-3 h-3" />
              </div>
              {isDragEnabled ? 'DND On' : 'DND Off'}
            </button>
          </div>
        </div>

        <div className="flex gap-6 items-start">
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar"
          >
            <div className="flex gap-4 min-w-[1000px]">
              {DAYS.map(day => (
                <motion.div 
                  key={day}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 min-w-[190px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h3 className={`font-bold text-sm capitalize ${day === 'sunday' ? 'text-rose-500' : 'text-slate-500'}`}>{day.slice(0, 3)}</h3>
                  </div>
                  <div className="p-3 space-y-4 flex-1">
                    <DroppableSlot 
                      day={day} 
                      slot="lunch" 
                      dishIds={currentPlan?.days[day]?.lunch?.dishIds || []} 
                      dishes={dishes}
                      onClick={() => handleSlotClick(day, 'lunch')}
                      onRemove={(dishId) => handleRemoveDish(day, 'lunch', dishId)}
                      isDragEnabled={isDragEnabled}
                    />
                    <DroppableSlot 
                      day={day} 
                      slot="dinner" 
                      dishIds={currentPlan?.days[day]?.dinner?.dishIds || []} 
                      dishes={dishes}
                      onClick={() => handleSlotClick(day, 'dinner')}
                      onRemove={(dishId) => handleRemoveDish(day, 'dinner', dishId)}
                      isDragEnabled={isDragEnabled}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {isLibraryOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsLibraryOpen(false)}
                className="fixed inset-0 bg-slate-900/5 z-50 lg:hidden"
              />
            )}
          </AnimatePresence>

          {/* Mobile Side Drawer (Slides in on mobile & tablet) - Bypasses transform nested bug in dnd-kit */}
          <div 
            style={{
              right: isLibraryOpen ? '0px' : '-330px',
              transition: 'right 300ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="fixed top-16 bottom-0 z-50 w-[220px] sm:w-[250px] max-w-[80vw] flex flex-col bg-slate-50 border-l border-slate-200 shadow-2xl p-4 lg:hidden"
          >
            <div className="flex flex-col h-full">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Dish Library</h4>
                  <div className="flex items-center gap-2">
                    {isDragEnabled && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">DND On</span>
                    )}
                    <button onClick={() => setIsLibraryOpen(false)} className="p-1.5 hover:bg-white rounded-lg text-slate-400">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <input 
                  type="text" 
                  placeholder="Search library..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1 pb-20">
                {filteredRepoDishes.map(dish => (
                  <DraggableDish key={`lib-mobile-${dish.id || (dish as any)._id}`} dish={dish} disabled={false} prefix="repo-mobile" />
                ))}
                {filteredRepoDishes.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium italic">
                    No dishes found...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Sidebar (Collapses smoothly to 0 width without unmounting to preserve dnd-kit measurements) */}
          <div 
            style={{
              width: isLibraryOpen ? '280px' : '0px',
              opacity: isLibraryOpen ? 1 : 0,
              marginLeft: isLibraryOpen ? '24px' : '0px',
              pointerEvents: isLibraryOpen ? 'auto' : 'none',
              transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="hidden lg:flex flex-col bg-slate-50 rounded-[2.5rem] border border-slate-200 shadow-inner overflow-hidden p-4 h-[600px] sticky top-4 shrink-0"
          >
            <div className="flex flex-col h-full min-w-[248px]">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Dish Library</h4>
                  <div className="flex items-center gap-2">
                    {isDragEnabled && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">DND On</span>
                    )}
                    <button onClick={() => setIsLibraryOpen(false)} className="p-1 hover:bg-white rounded-lg text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input 
                  type="text" 
                  placeholder="Search library..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="w-full px-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filteredRepoDishes.map(dish => (
                  <DraggableDish key={`lib-desktop-${dish.id || (dish as any)._id}`} dish={dish} disabled={false} prefix="repo-desktop" />
                ))}
                {filteredRepoDishes.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium italic">
                    No dishes found...
                  </div>
                )}
              </div>
            </div>
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
                    .filter(d => d.isRegular !== false)
                    .map(dish => {
                      const slotData = currentPlan?.days[selectingSlot.day as keyof WeeklyPlan['days']][selectingSlot.slot];
                      const dishIds = slotData?.dishIds || [];
                      const isSelected = dishIds.includes(dish.id || (dish as any)._id);
                      return (
                        <button
                          key={dish.id || (dish as any)._id}
                          onClick={() => handleSelectDish(dish.id || (dish as any)._id)}
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
      
      {/* Drag Overlay for smooth preview */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            (() => {
              const dish = dishes.find(d => {
                const id = d.id || (d as any)._id;
                return activeDragId.includes(id);
              });
              if (!dish) return null;
              return (
                <div className="p-3 bg-white rounded-2xl shadow-2xl border-2 border-emerald-500 ring-4 ring-emerald-500/10 min-w-[180px] max-w-[240px] cursor-grabbing select-none">
                  <p className="text-xs font-bold text-slate-800 truncate">{dish.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{dish.category}</p>
                </div>
              );
            })()
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
