/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Utensils, ShoppingCart, Users, ChevronRight, Menu, X, Plus, LogOut, Wand2, Share2, CheckCircle2, Trash2, Apple } from 'lucide-react';
import WeeklyPlanner from './components/WeeklyPlanner';
import DishRepository from './components/DishRepository';
import ShoppingList from './components/ShoppingList';
import FridgeStock from './components/FridgeStock';
import Auth from './components/Auth';
import { Group, Dish, WeeklyPlan } from './types';
import { apiFetch } from './lib/api';

export default function App() {
  const [user, setUser] = useState<{id: string, name: string, email: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'planner' | 'dishes' | 'shopping' | 'fridge'>('planner');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await apiFetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            fetchInitialData();
          } else {
            localStorage.removeItem('token');
            setLoading(false);
          }
        } catch {
          localStorage.removeItem('token');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (activeGroup && user) {
      fetchGroupData();
    }
  }, [activeGroup, user]);

  const fetchInitialData = async () => {
    try {
      const res = await apiFetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        if (data.length > 0 && !activeGroup) setActiveGroup(data[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      const res = await apiFetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName }),
      });
      if (res.ok) {
        const created = await res.json();
        setGroups([...groups, created]);
        setActiveGroup(created);
        setNewGroupName('');
        setIsGroupModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to create group", error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const res = await apiFetch(`/api/groups/${groupId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const remaining = groups.filter(g => g.id !== groupId);
        setGroups(remaining);
        if (activeGroup?.id === groupId) {
          if (remaining.length > 0) {
            setActiveGroup(remaining[0]);
          } else {
            setActiveGroup(null);
            setDishes([]);
            setPlans([]);
          }
        }
        setGroupToDelete(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete group");
      }
    } catch (error) {
      console.error("Failed to delete group", error);
    }
  };

  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleAddMember = async () => {
    if (!newMemberEmail || !activeGroup) return;
    try {
      const res = await apiFetch(`/api/groups/${activeGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail }),
      });
      if (res.ok) {
        const updatedGroup = await res.json();
        setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
        setActiveGroup(updatedGroup);
        setInviteSuccess(true);
        setTimeout(() => {
          setInviteSuccess(false);
          setIsInviteModalOpen(false);
          setNewMemberEmail('');
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to add member", error);
    }
  };

  const copyInviteLink = () => {
    const text = `Join my meal planning space "${activeGroup?.name}" on MealFlow! Just sign up with your email to see our shared menu.`;
    navigator.clipboard.writeText(text);
    alert("Invite message copied to clipboard! Share it with your friend.");
  };

  const fetchGroupData = async () => {
    if (!activeGroup) return;
    try {
      const [dishesRes, plansRes] = await Promise.all([
        apiFetch(`/api/groups/${activeGroup.id}/dishes`),
        apiFetch(`/api/groups/${activeGroup.id}/plans`)
      ]);
      if (dishesRes.ok) setDishes(await dishesRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
    } catch (error) {
      console.error(error);
    }
  };

  const currentWeekId = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  };

  const activePlan = plans.find(p => p.weekId === currentWeekId());

  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const getWeekId = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = (format: 'whatsapp' | 'email') => {
    const plan = plans.find(p => p.weekId === getWeekId(currentWeek));
    if (!plan) {
      alert("No plan to share for this week!");
      return;
    }

    let text = `📅 Meal Plan for ${getWeekId(currentWeek)}\n\n`;
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
      const dayPlan = plan.days[day as keyof WeeklyPlan['days']];
      const lunchDishesNames = dayPlan.lunch.dishIds.map(id => dishes.find(d => (d.id === id || (d as any)._id === id))?.name || '---').join(', ');
      const dinnerDishesNames = dayPlan.dinner.dishIds.map(id => dishes.find(d => (d.id === id || (d as any)._id === id))?.name || '---').join(', ');
      text += `*${day.toUpperCase()}*\n`;
      text += `Lunch: ${lunchDishesNames || '---'}\n`;
      text += `Dinner: ${dinnerDishesNames || '---'}\n\n`;
    });

    if (format === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.location.href = `mailto:?subject=Weekly Meal Plan&body=${encodeURIComponent(text)}`;
    }
    
    document.getElementById('header-share-menu')?.classList.add('hidden');
  };

  const navItems = [
    { id: 'planner', label: 'Weekly Planner', icon: LayoutDashboard },
    { id: 'dishes', label: 'Dish Repository', icon: Utensils },
    { id: 'shopping', label: 'Shopping List', icon: ShoppingCart },
    { id: 'fridge', label: 'Fridge Stock', icon: Apple },

  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setGroups([]);
    setActiveGroup(null);
  };

  if (!user) {
    return <Auth onLogin={(token, userData) => {
      localStorage.setItem('token', token);
      setUser(userData);
      setLoading(true);
      fetchInitialData();
    }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 flex-col bg-white border-r border-slate-200 p-8 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">MealFlow</h1>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {activeTab === item.id && (
                <motion.div layoutId="nav-pill" className="ml-auto">
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              )}
            </button>
          ))}
        </nav>

          <div className="mt-auto p-4 bg-slate-50 rounded-3xl border border-slate-200">
          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Space Members</p>
            <div className="flex flex-wrap items-center -space-x-2">
              {activeGroup?.members?.map((m: string, i: number) => (
                <div key={i} className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-emerald-700 relative group overflow-hidden" title={m}>
                   {m.slice(0,2).toUpperCase()}
                </div>
              ))}
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                title="Add Member"
                className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 border-dashed flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-colors z-10"
              >
                 <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3 pt-3 border-t border-slate-200">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Space</p>
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="text-sm font-bold text-slate-800 truncate hover:text-emerald-600 transition-colors text-left w-full"
              >
                {activeGroup?.name}
              </button>
            </div>
          </div>
          <button 
            onClick={() => setIsGroupModalOpen(true)}
            className="w-full py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white/50 transition-colors mb-2"
          >
            Switch Group
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors uppercase tracking-wider"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Invite Member Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <motion.div 
            key="invite-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6"
            >
              <h2 className="text-xl font-bold text-slate-800 mb-2">Space Settings</h2>
              <p className="text-sm text-slate-500 mb-6 px-1">Manage members and settings for <strong>{activeGroup?.name}</strong>.</p>
              
              <div className="mb-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Current Members</p>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {activeGroup?.members?.map((memberEmail: string) => (
                    <div key={memberEmail} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group/member">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 shrink-0">
                          {memberEmail.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-slate-700 truncate" title={memberEmail}>{memberEmail}</span>
                      </div>
                      {memberEmail !== user.email && (
                        <button 
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to remove ${memberEmail}?`)) return;
                            try {
                              const res = await apiFetch(`/api/groups/${activeGroup.id}/members/${memberEmail}`, {
                                method: 'DELETE'
                              });
                              if (res.ok) {
                                const updated = await res.json();
                                setGroups(groups.map(g => g.id === updated.id ? updated : g));
                                setActiveGroup(updated);
                              }
                            } catch (error) {
                              console.error("Failed to remove member", error);
                            }
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {inviteSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center"
                >
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-emerald-600 font-bold">Successfully Invited!</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="friend@example.com" 
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                    />
                  </div>
                  
                  <button 
                    onClick={copyInviteLink}
                    className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Or Copy Invite Message
                  </button>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setIsInviteModalOpen(false)}
                      className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddMember}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-md shadow-emerald-100 hover:bg-emerald-700 transition-all"
                    >
                      Invite
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Switch Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <motion.div 
            key="group-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGroupModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6"
            >
              <h2 className="text-xl font-bold text-slate-800 mb-4">Switch Space</h2>
              <div className="space-y-2 mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                {groups.map(group => (
                  <div
                    key={group.id}
                    className={`w-full flex items-center justify-between p-2 rounded-2xl border transition-all ${
                      activeGroup?.id === group.id 
                      ? 'border-emerald-500 bg-emerald-50/50' 
                      : 'border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveGroup(group);
                        setIsGroupModalOpen(false);
                      }}
                      className="flex-1 text-left px-2 py-1 flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                      {activeGroup?.id === group.id && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupToDelete(group);
                      }}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="Delete Space"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Create New Space</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="E.g., Summer House" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                  />
                  <button 
                    onClick={handleCreateGroup}
                    className="px-4 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-md shadow-emerald-100 hover:bg-emerald-700 transition-all"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Deletion Confirmation Modal */}
      <AnimatePresence>
        {groupToDelete && (
          <motion.div 
            key="delete-confirm-modal"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100"
            >
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Delete Space?</h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Are you sure you want to permanently delete <strong>{groupToDelete.name}</strong>? All recipes, plans, lists, and members under this space will be deleted. This cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setGroupToDelete(null)}
                  className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteGroup(groupToDelete.id)}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold shadow-md transition-all text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-[70]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Utensils className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">MealFlow</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(prev => !prev)} 
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          aria-label="Toggle Menu"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div key="mobile-sidebar">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-80 bg-white z-[90] p-8 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Utensils className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-800">MealFlow</h1>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="space-y-1 mb-8">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === item.id 
                        ? 'bg-emerald-50 text-emerald-600' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="mt-auto space-y-6">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200">
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Space Members</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeGroup?.members?.map((m: string, i: number) => (
                        <div key={i} className="w-9 h-9 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-700 shadow-sm" title={m}>
                          {m.slice(0,2).toUpperCase()}
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          setIsInviteModalOpen(true);
                          setIsSidebarOpen(false);
                        }}
                        className="w-9 h-9 rounded-full bg-white border-2 border-slate-200 border-dashed flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="px-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Space</p>
                      <button 
                        onClick={() => {
                          setIsInviteModalOpen(true);
                          setIsSidebarOpen(false);
                        }}
                        className="text-sm font-bold text-slate-800 truncate hover:text-emerald-600 transition-colors text-left w-full"
                      >
                        {activeGroup?.name}
                      </button>
                    </div>
                    <button 
                      onClick={() => {
                        setIsGroupModalOpen(true);
                        setIsSidebarOpen(false);
                      }}
                      className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Switch Space
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors uppercase tracking-wider"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 pt-20 pb-20 lg:pt-8 overflow-y-auto min-h-screen">
        <div className="max-w-6xl mx-auto px-4">
          <header className="flex justify-between items-center mb-8 gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight truncate">
                {navItems.find(n => n.id === activeTab)?.label}
              </h2>
              <p className="text-slate-500 font-medium text-sm sm:text-base truncate">Hello! Ready to plan your week?</p>
            </div>

            {activeTab === 'planner' && activeGroup && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={isGenerating}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('trigger-ai-generate'));
                  }}
                  className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-100 ${isGenerating ? 'opacity-50' : 'hover:bg-emerald-700 active:scale-95'}`}
                  title="Auto-Generate Weekly Menu"
                >
                  <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Auto-Generate</span>
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => document.getElementById('header-share-menu')?.classList.toggle('hidden')}
                    className="p-2 sm:p-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm"
                    title="Share Plan"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <div id="header-share-menu" className="absolute right-0 top-full mt-2 hidden z-50">
                    <div 
                      className="fixed inset-0" 
                      onClick={() => document.getElementById('header-share-menu')?.classList.add('hidden')}
                    />
                    <div className="relative bg-white border border-slate-200 rounded-2xl shadow-xl p-2 w-44 flex flex-col gap-1">
                      <button 
                        onClick={() => handleShare('whatsapp')} 
                        className="text-left px-3 py-2.5 text-sm hover:bg-slate-50 rounded-xl text-slate-600 font-bold flex items-center gap-2 transition-colors"
                      >
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        WhatsApp
                      </button>
                      <button 
                        onClick={() => handleShare('email')} 
                        className="text-left px-3 py-2.5 text-sm hover:bg-slate-50 rounded-xl text-slate-600 font-bold flex items-center gap-2 transition-colors"
                      >
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                        Email
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </header>

          <AnimatePresence mode="wait">
            {!activeGroup ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Space Selected</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm">
                  Create a new space or select an existing one to start planning your meals.
                </p>
                <button 
                  onClick={() => setIsGroupModalOpen(true)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                >
                  Create Your First Space
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'planner' && (
                  <WeeklyPlanner 
                    groupId={activeGroup.id} 
                    dishes={dishes} 
                    onPlanUpdate={fetchGroupData}
                    currentWeek={currentWeek}
                    onWeekChange={setCurrentWeek}
                    onLoadingChange={setIsGenerating}
                  />
                )}
                {activeTab === 'dishes' && (
                  <DishRepository 
                    groupId={activeGroup.id} 
                    dishes={dishes} 
                    onDishesUpdate={fetchGroupData} 
                  />
                )}
                {activeTab === 'shopping' && (
                  <ShoppingList groupId={activeGroup.id} plan={activePlan || null} dishes={dishes} plans={plans} />
                )}
                {activeTab === 'fridge' && (
                  <FridgeStock groupId={activeGroup.id} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Tab Bar */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 h-16 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 px-6 flex items-center justify-between z-40 shadow-2xl">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === item.id ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

