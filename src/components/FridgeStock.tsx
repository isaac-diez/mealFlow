import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Camera, X, Check, Sparkles, Apple, Archive, FileText } from 'lucide-react';
import { FridgeItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

interface FridgeStockProps {
  groupId: string;
}

export default function FridgeStock({ groupId }: FridgeStockProps) {
  const [fridgeList, setFridgeList] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual addition state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Dairy/Eggs');

  // Photo analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<Omit<FridgeItem, 'id' | 'groupId'>[] | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const customCategories = [
    'Dairy/Eggs',
    'Vegetables',
    'Proteins',
    'Pantry',
    'Bakery',
    'Beverages',
    'Other'
  ];

  const fetchFridgeStock = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/groups/${groupId}/fridge`);
      if (res.ok) {
        setFridgeList(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch fridge stock", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchFridgeStock();
  }, [fetchFridgeStock]);

  const handleAddFridgeItem = async (name: string, quantity: string, category: string, inStock: boolean = true) => {
    try {
      const res = await apiFetch(`/api/groups/${groupId}/fridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, quantity, category, inStock })
      });
      if (res.ok) {
        const item = await res.json();
        // Insert or update local array
        setFridgeList(prev => {
          const index = prev.findIndex(i => i.id === item.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = item;
            return copy;
          }
          return [...prev, item];
        });
      }
    } catch (error) {
      console.error("Failed to add fridge item", error);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    await handleAddFridgeItem(
      newItemName.trim(),
      newItemQuantity.trim() || '1 unit',
      newItemCategory,
      true
    );

    setNewItemName('');
    setNewItemQuantity('');
    setNewItemCategory('Dairy/Eggs');
    setIsAddModalOpen(false);
  };

  const handleToggleStock = async (item: FridgeItem, targetStock: boolean) => {
    try {
      // Optimistic state
      setFridgeList(prev => prev.map(i => i.id === item.id ? { ...i, inStock: targetStock } : i));

      const res = await apiFetch(`/api/groups/${groupId}/fridge/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock: targetStock })
      });

      if (!res.ok) {
        // Revert
        setFridgeList(prev => prev.map(i => i.id === item.id ? { ...i, inStock: item.inStock } : i));
      }
    } catch (error) {
      console.error("Failed to toggle stock status", error);
      fetchFridgeStock();
    }
  };

  const removeFridgeItemPermanently = async (id: string) => {
    try {
      const original = [...fridgeList];
      setFridgeList(prev => prev.filter(item => item.id !== id));

      const res = await apiFetch(`/api/groups/${groupId}/fridge/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        setFridgeList(original);
      }
    } catch (error) {
      console.error("Failed to permanently delete fridge item", error);
      fetchFridgeStock();
    }
  };

  // Photo Scan handlers
  const handleLaunchCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview local
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    setAnalyzing(true);
    setScanError(null);
    setScanResult(null);
    setIsScanModalOpen(true);

    try {
      // Get base64 string without meta prefix
      const base64Reader = new FileReader();
      base64Reader.onloadend = async () => {
        const base64data = (base64Reader.result as string).split(',')[1];
        try {
          const res = await apiFetch(`/api/groups/${groupId}/fridge/recognize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64data,
              mimeType: file.type || 'image/jpeg'
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              setScanResult(data.items);
            } else {
              setScanError("Gemini couldn't recognize any specific food items from this photo. Please try another shot of cooking ingredients or products!");
            }
          } else {
            const err = await res.json();
            setScanError(err.error || "Failed to analyze photo");
          }
        } catch (postErr) {
          console.error("Photo posting error", postErr);
          setScanError("Connection error while requesting remote AI analysis.");
        } finally {
          setAnalyzing(false);
        }
      };
      base64Reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setScanError("Failed reading file stream.");
      setAnalyzing(false);
    }
  };

  const handleAddScannedItems = async () => {
    if (!scanResult) return;
    for (const item of scanResult) {
      await handleAddFridgeItem(item.name, item.quantity, item.category, true);
    }
    // Clean and close
    setScanResult(null);
    setPreviewImage(null);
    setIsScanModalOpen(false);
  };

  // Categorize local states
  const inStockItems = fridgeList.filter(item => item.inStock);
  const historyItems = fridgeList.filter(item => !item.inStock);

  // Group active stock by categories
  const groupedInStock: Record<string, FridgeItem[]> = {};
  inStockItems.forEach(item => {
    const cat = item.category || 'Other';
    if (!groupedInStock[cat]) groupedInStock[cat] = [];
    groupedInStock[cat].push(item);
  });

  const activeCategories = Object.keys(groupedInStock).sort();

  return (
    <div className="space-y-10">
      {/* Top Section: Active Fridge Stock */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl md:text-4xl font-bold mb-2">Fridge Stock</h2>
              <p className="text-slate-400 text-sm font-medium">Keep control of what is currently inside your fridge</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Hidden native input with photo capture parameters */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              <button
                onClick={handleLaunchCamera}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl transition-all font-bold text-sm shadow-xl shadow-emerald-950/30 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-emerald-100" />
                Scan Product
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 hover:text-white text-slate-100 rounded-2xl transition-all font-bold text-sm border border-white/10 shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Manual Add
              </button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-2 min-h-[140px]">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <motion.div
                  key="loading-fridge"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-16 text-center text-slate-400 font-medium flex flex-col items-center gap-3"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full"
                  />
                  Fetching your fridge inventory...
                </motion.div>
              ) : inStockItems.length === 0 ? (
                <motion.div
                  key="empty-fridge"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-16 text-center text-slate-400 max-w-md mx-auto"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <Apple className="w-5 h-5 text-slate-400 animate-pulse" />
                  </div>
                  <h4 className="font-bold text-white mb-1 text-sm">Your Fridge is Empty</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Quickly add food products using your mobile camera or type them in manually to begin monitoring your kitchen inventory!
                  </p>
                </motion.div>
              ) : (
                <motion.div key="fridge-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2">
                    {activeCategories.map(category => (
                      <div key={category} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{category}</span>
                          <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300 font-bold">
                            {groupedInStock[category].length} items
                          </span>
                        </div>
                        <div className="space-y-1.5 flex-1">
                          {groupedInStock[category].map(item => (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            >
                              <div className="flex flex-col flex-1 min-w-0 pr-2">
                                <span className="font-bold text-xs text-white truncate">{item.name}</span>
                                <span className="text-[9px] font-semibold text-slate-500 truncate">{item.quantity}</span>
                              </div>
                              <button
                                onClick={() => handleToggleStock(item, false)}
                                title="Consume / Take out from fridge"
                                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Section: Previously in stock (History suggestions) */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-emerald-500 rounded-full" />
          <h3 className="text-xl font-bold text-slate-800">Previously in stock</h3>
        </div>

        {historyItems.length > 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
            <p className="text-xs text-slate-400 font-medium mb-4 leading-relaxed">
              These products have been in the fridge stock at some point. Tap the '+' button to refill or re-add them directly!
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {historyItems.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-bold text-xs text-slate-700 truncate">{item.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 truncate">{item.quantity} · {item.category}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStock(item, true)}
                        title="Re-add to stock"
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFridgeItemPermanently(item.id)}
                        title="Delete permanently"
                        className="p-2 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm max-w-lg mx-auto w-full">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
              <Archive className="w-5 h-5 text-slate-300" />
            </div>
            <h4 className="text-slate-700 font-bold text-xs mb-1">No historical stock suggestion</h4>
            <p className="text-slate-400 text-[11px] px-6">
              When you empty items from active stock using their trash bin icons, they'll appear here ready to be re-added later, saving you from typing them in again!
            </p>
          </div>
        )}
      </div>

      {/* Manual Custom Item Addition Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden w-full max-w-md p-8 z-50 border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Add Fridge Product</h3>
                  <p className="text-slate-400 text-xs font-medium mt-1">Manually supply fridge item details</p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Product Product *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Whole Milk, Goat Cheese, Spinach"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Quantity / Portion
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2 cartons, 300g"
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
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-emerald-990/10 transition-colors"
                  >
                    Add Product
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Camera Capture Scan Results Modal */}
      <AnimatePresence>
        {isScanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!analyzing) setIsScanModalOpen(false);
              }}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden w-full max-w-md p-8 z-50 border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                    AI Snapshot Analyzer
                  </h3>
                  <p className="text-slate-400 text-xs font-medium mt-1">Smart product recognition in real-time</p>
                </div>
                {!analyzing && (
                  <button
                    onClick={() => setIsScanModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Local Shot Preview thumbnail */}
              {previewImage && (
                <div className="relative w-full h-40 bg-slate-100 rounded-2xl overflow-hidden mb-6 flex items-center justify-center border border-slate-200">
                  <img src={previewImage} alt="Product Capture" className="w-full h-full object-cover" />
                  {analyzing && (
                    <div className="absolute inset-0 bg-slate-900/40 flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                      {/* Scanning visual laser line effect */}
                      <motion.div
                        className="absolute left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_8px_#10b981]"
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                      />
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full mb-2"
                      />
                      <span className="text-xs font-bold tracking-widest uppercase text-emerald-200 animate-pulse">
                        Analyzing photo...
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar min-h-[100px] mb-6">
                {analyzing ? (
                  <div className="text-center py-6 text-slate-400 font-medium text-xs leading-relaxed">
                    Gemini AI is processing your image, matching patterns, and extracting ingredients and food products...
                  </div>
                ) : scanError ? (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-medium leading-relaxed flex flex-col gap-3">
                    <div>{scanError}</div>
                    <button
                      onClick={handleLaunchCamera}
                      className="py-2.5 px-4 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl font-bold transition-all self-start text-xs cursor-pointer"
                    >
                      Retry Another Photo
                    </button>
                  </div>
                ) : scanResult ? (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                      We found {scanResult.length} product(s):
                    </h4>
                    <div className="space-y-2">
                      {scanResult.map((item, index) => (
                        <div key={index} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                          <div className="flex flex-col min-w-0 pr-2">
                            {/* Editable name & detail in scan */}
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const copy = [...scanResult];
                                copy[index].name = e.target.value;
                                setScanResult(copy);
                              }}
                              className="font-bold text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none py-0.5"
                            />
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="text"
                                value={item.quantity}
                                onChange={(e) => {
                                  const copy = [...scanResult];
                                  copy[index].quantity = e.target.value;
                                  setScanResult(copy);
                                }}
                                className="text-[9px] font-bold text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none w-20 py-0.5"
                              />
                              <span className="text-[10px] text-slate-300">|</span>
                              <select
                                value={item.category}
                                onChange={(e) => {
                                  const copy = [...scanResult];
                                  copy[index].category = e.target.value;
                                  setScanResult(copy);
                                }}
                                className="text-[9px] font-bold text-slate-400 bg-transparent focus:outline-none"
                              >
                                {customCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setScanResult(prev => prev ? prev.filter((_, idx) => idx !== index) : null);
                            }}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {!analyzing && (scanResult || scanError) && (
                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    onClick={() => {
                      setScanResult(null);
                      setPreviewImage(null);
                      setIsScanModalOpen(false);
                    }}
                    className="flex-1 py-3 text-slate-500 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs"
                  >
                    Discard
                  </button>
                  {scanResult && scanResult.length > 0 && (
                    <button
                      onClick={handleAddScannedItems}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/10 transition-all text-xs flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Add to Stock
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
