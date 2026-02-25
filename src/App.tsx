/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Sprout, 
  CloudSun, 
  TrendingUp, 
  MapPin, 
  Calendar, 
  Weight, 
  Thermometer, 
  Droplets, 
  CloudRain, 
  AlertTriangle, 
  DollarSign, 
  BarChart3, 
  Package, 
  Truck,
  Loader2,
  ChevronRight,
  Info,
  Gavel,
  Store,
  Building2,
  User,
  Plus,
  History,
  Clock
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type DemandLevel = 'low' | 'medium' | 'high';
type RiskLevel = 'none' | 'low' | 'medium' | 'high';
type UserRole = 'farmer' | 'wholesale' | 'store';

interface Auction {
  id: number;
  crop_name: string;
  quantity: number;
  base_price: number;
  current_price: number;
  farmer_name: string;
  location: string;
  status: string;
  created_at: string;
}

interface FormData {
  crop_name: string;
  district: string;
  state: string;
  country: string;
  harvest_date: string;
  quantity: string;
  temperature: string;
  rainfall: string;
  humidity: string;
  extreme_weather_risk: RiskLevel;
  past_price: string;
  demand_level: DemandLevel;
  regional_supply: string;
  regional_demand: string;
  transport_cost_index: DemandLevel;
  storage_availability: DemandLevel;
}

const initialForm: FormData = {
  crop_name: 'Wheat',
  district: 'Ludhiana',
  state: 'Punjab',
  country: 'India',
  harvest_date: '2026-04-15',
  quantity: '50',
  temperature: '28',
  rainfall: '10',
  humidity: '45',
  extreme_weather_risk: 'low',
  past_price: '22',
  demand_level: 'medium',
  regional_supply: '5000',
  regional_demand: '4800',
  transport_cost_index: 'medium',
  storage_availability: 'high',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'auction'>('intelligence');
  const [role, setRole] = useState<UserRole>('farmer');
  const [userName, setUserName] = useState('');
  
  // Intelligence State
  const [formData, setFormData] = useState<FormData>(initialForm);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auction State
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [showAuctionForm, setShowAuctionForm] = useState(false);
  const [newAuction, setNewAuction] = useState({
    crop_name: '',
    quantity: '',
    base_price: '',
    location: ''
  });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Fetch initial auctions
    fetch('/api/auctions')
      .then(res => res.json())
      .then(data => setAuctions(data));

    // WebSocket Setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_AUCTION') {
        setAuctions(prev => [data.auction, ...prev]);
      } else if (data.type === 'NEW_BID') {
        setAuctions(prev => prev.map(a => a.id === data.auction.id ? data.auction : a));
      }
    };

    return () => socket.close();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIntelligenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const prompt = `
        You are an AI Agricultural Market Intelligence System.
        Analyze the following data to predict fair market price and provide business recommendations for a direct Farmer-to-Customer marketplace.

        INPUT DATA:
        Crop Details:
        - Crop Name: ${formData.crop_name}
        - Farmer Location: ${formData.district}, ${formData.state}, ${formData.country}
        - Expected Harvest Date: ${formData.harvest_date}
        - Expected Quantity (tons): ${formData.quantity}

        Weather Data (Next 30–60 Days Forecast):
        - Average Temperature: ${formData.temperature} °C
        - Rainfall Level: ${formData.rainfall} mm
        - Humidity: ${formData.humidity} %
        - Extreme Weather Risk: ${formData.extreme_weather_risk}

        Market Data:
        - Past 5-Year Average Price (per kg): ₹${formData.past_price}
        - Current Demand Level: ${formData.demand_level}
        - Estimated Regional Total Production: ${formData.regional_supply}
        - Estimated Regional Total Demand: ${formData.regional_demand}
        - Transport Cost Index: ${formData.transport_cost_index}
        - Storage Availability: ${formData.storage_availability}

        TASKS:
        1. Predict expected fair market price per kg.
        2. Explain how weather affects production.
        3. Analyze demand vs supply balance.
        4. Predict price direction (Increase / Decrease / Stable).
        5. Provide Risk Level (Low / Medium / High).
        6. Recommend action (Pre-sell now, Wait and sell, Store and sell later, Increase cultivation next season).
        7. If data is insufficient, clearly state limitations.

        OUTPUT FORMAT (Strictly follow this):
        Predicted Price: ₹___ per kg  
        Price Direction: ___  
        Supply-Demand Status: ___  
        Weather Impact: ___  
        Risk Level: ___  
        Recommendation: ___  
        Reasoning: ___  

        Use logical, data-driven reasoning. Avoid assumptions. Base conclusions strictly on given inputs.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setResult(response.text || "No response generated.");
    } catch (err: any) {
      setError(err.message || "An error occurred while generating the prediction.");
    } finally {
      setLoading(false);
    }
  };

  const createAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName) return alert("Please enter your name first");
    
    await fetch('/api/auctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newAuction,
        farmer_name: userName,
        quantity: parseFloat(newAuction.quantity),
        base_price: parseFloat(newAuction.base_price)
      })
    });
    
    setShowAuctionForm(false);
    setNewAuction({ crop_name: '', quantity: '', base_price: '', location: '' });
  };

  const placeBid = async (auctionId: number, currentPrice: number) => {
    if (!userName) return alert("Please enter your name first");
    const bidAmount = currentPrice + 1; // Simple increment for demo
    
    const res = await fetch('/api/bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auction_id: auctionId,
        bidder_name: userName,
        bidder_type: role,
        amount: bidAmount
      })
    });
    
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Sprout size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">AgriIntel</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-black/5 p-1 rounded-lg text-sm font-medium">
              <button 
                onClick={() => setActiveTab('intelligence')}
                className={cn(
                  "px-4 py-1.5 rounded-md transition-all",
                  activeTab === 'intelligence' ? "bg-white shadow-sm text-emerald-600" : "text-black/60 hover:text-black"
                )}
              >
                Intelligence
              </button>
              <button 
                onClick={() => setActiveTab('auction')}
                className={cn(
                  "px-4 py-1.5 rounded-md transition-all flex items-center gap-2",
                  activeTab === 'auction' ? "bg-white shadow-sm text-emerald-600" : "text-black/60 hover:text-black"
                )}
              >
                <Gavel size={16} />
                Live Auction
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Role & Profile Bar */}
      <div className="bg-white border-b border-black/5 py-3">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-black/40">Access Mode:</span>
            <div className="flex gap-2">
              {[
                { id: 'farmer', label: 'Farmer', icon: Sprout },
                { id: 'wholesale', label: 'Wholesale', icon: Building2 },
                { id: 'store', label: 'Store', icon: Store }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id as UserRole)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    role === r.id 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                      : "bg-white border-black/5 text-black/60 hover:border-black/20"
                  )}
                >
                  <r.icon size={14} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-lg">
              <User size={14} className="text-black/40" />
              <input 
                type="text"
                placeholder="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none w-32"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'intelligence' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Info size={18} className="text-emerald-600" />
                  <h2 className="font-semibold text-lg">Input Parameters</h2>
                </div>

                <form onSubmit={handleIntelligenceSubmit} className="space-y-8">
                  {/* Crop Details */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/40 mb-2">
                      <Sprout size={14} />
                      Crop Details
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Crop Name</label>
                        <input 
                          name="crop_name"
                          value={formData.crop_name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. Wheat"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Harvest Date</label>
                        <input 
                          type="date"
                          name="harvest_date"
                          value={formData.harvest_date}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">District</label>
                        <input 
                          name="district"
                          value={formData.district}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">State</label>
                        <input 
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Quantity (Tons)</label>
                        <input 
                          type="number"
                          name="quantity"
                          value={formData.quantity}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Weather Data */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/40 mb-2">
                      <CloudSun size={14} />
                      Weather Forecast (30-60 Days)
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Avg Temp (°C)</label>
                        <input 
                          type="number"
                          name="temperature"
                          value={formData.temperature}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Rainfall (mm)</label>
                        <input 
                          type="number"
                          name="rainfall"
                          value={formData.rainfall}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Humidity (%)</label>
                        <input 
                          type="number"
                          name="humidity"
                          value={formData.humidity}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Extreme Risk</label>
                        <select 
                          name="extreme_weather_risk"
                          value={formData.extreme_weather_risk}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="none">None</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Market Data */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/40 mb-2">
                      <BarChart3 size={14} />
                      Market Dynamics
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Past 5y Avg (₹/kg)</label>
                        <input 
                          type="number"
                          name="past_price"
                          value={formData.past_price}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Demand Level</label>
                        <select 
                          name="demand_level"
                          value={formData.demand_level}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Regional Supply (Tons)</label>
                        <input 
                          type="number"
                          name="regional_supply"
                          value={formData.regional_supply}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Regional Demand (Tons)</label>
                        <input 
                          type="number"
                          name="regional_demand"
                          value={formData.regional_demand}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Transport Cost</label>
                        <select 
                          name="transport_cost_index"
                          value={formData.transport_cost_index}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/60">Storage Availability</label>
                        <select 
                          name="storage_availability"
                          value={formData.storage_availability}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-black/5 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        Generate Intelligence
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Analysis Section */}
            <div className="lg:col-span-7 space-y-6">
              {!result && !loading && !error && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-dashed border-black/10">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                    <TrendingUp size={32} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Ready for Analysis</h3>
                  <p className="text-black/40 max-w-xs text-sm">
                    Fill in the crop and market details to generate a comprehensive price prediction and business recommendation.
                  </p>
                </div>
              )}

              {loading && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-black/5 shadow-sm">
                  <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
                  <h3 className="text-lg font-semibold mb-2">Analyzing Market Data</h3>
                  <p className="text-black/40 max-w-xs text-sm">
                    Our AI is processing weather patterns, supply chain dynamics, and historical trends...
                  </p>
                </div>
              )}

              {error && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4">
                  <AlertTriangle className="text-red-600 shrink-0" size={24} />
                  <div>
                    <h3 className="font-semibold text-red-900">Analysis Failed</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-black/5 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-600" />
                        <h2 className="font-semibold text-xl">Market Intelligence Report</h2>
                      </div>
                      <div className="text-xs font-mono text-black/40">
                        ID: {Math.random().toString(36).substring(7).toUpperCase()}
                      </div>
                    </div>

                    <div className="prose prose-sm max-w-none prose-emerald prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-black/70 prose-strong:text-black">
                      <div className="markdown-body">
                        <Markdown>{result}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Auction Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Live Crop Auctions</h2>
                <p className="text-black/40 mt-1">Direct bidding for wholesale vendors and departmental stores.</p>
              </div>
              {role === 'farmer' && (
                <button 
                  onClick={() => setShowAuctionForm(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                >
                  <Plus size={20} />
                  List New Crop
                </button>
              )}
            </div>

            {/* Auction Form Modal */}
            {showAuctionForm && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Create New Auction</h3>
                    <button onClick={() => setShowAuctionForm(false)} className="text-black/40 hover:text-black">✕</button>
                  </div>
                  <form onSubmit={createAuction} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-black/40 uppercase">Crop Name</label>
                      <input 
                        required
                        value={newAuction.crop_name}
                        onChange={e => setNewAuction({...newAuction, crop_name: e.target.value})}
                        className="w-full px-4 py-2 bg-black/5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g. Basmati Rice"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-black/40 uppercase">Quantity (Tons)</label>
                        <input 
                          required
                          type="number"
                          value={newAuction.quantity}
                          onChange={e => setNewAuction({...newAuction, quantity: e.target.value})}
                          className="w-full px-4 py-2 bg-black/5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-black/40 uppercase">Base Price (₹/kg)</label>
                        <input 
                          required
                          type="number"
                          value={newAuction.base_price}
                          onChange={e => setNewAuction({...newAuction, base_price: e.target.value})}
                          className="w-full px-4 py-2 bg-black/5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-black/40 uppercase">Pickup Location</label>
                      <input 
                        required
                        value={newAuction.location}
                        onChange={e => setNewAuction({...newAuction, location: e.target.value})}
                        className="w-full px-4 py-2 bg-black/5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g. Mandi, Punjab"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold mt-4 shadow-lg shadow-emerald-100">
                      Start Auction
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Auction Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {auctions.map(auction => (
                <div key={auction.id} className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-black group-hover:text-emerald-600 transition-colors">{auction.crop_name}</h3>
                      <div className="flex items-center gap-1 text-xs text-black/40 mt-1">
                        <MapPin size={12} />
                        {auction.location}
                      </div>
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                      Live
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-black/5 p-3 rounded-xl">
                      <div className="text-[10px] font-bold text-black/40 uppercase mb-1">Quantity</div>
                      <div className="text-lg font-bold">{auction.quantity} <span className="text-xs font-normal">Tons</span></div>
                    </div>
                    <div className="bg-emerald-600 p-3 rounded-xl text-white">
                      <div className="text-[10px] font-bold text-white/60 uppercase mb-1">Current Bid</div>
                      <div className="text-lg font-bold">₹{auction.current_price} <span className="text-xs font-normal">/kg</span></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center">
                        <User size={14} className="text-black/40" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-black/40 uppercase leading-none">Farmer</div>
                        <div className="font-semibold text-xs">{auction.farmer_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-black/40 text-xs">
                      <Clock size={12} />
                      {new Date(auction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {role !== 'farmer' && (
                    <button 
                      onClick={() => placeBid(auction.id, auction.current_price)}
                      className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"
                    >
                      <Gavel size={18} />
                      Place Bid (₹{auction.current_price + 1})
                    </button>
                  )}
                </div>
              ))}
            </div>

            {auctions.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-black/10">
                <Package size={48} className="mx-auto text-black/10 mb-4" />
                <h3 className="text-lg font-semibold">No Active Auctions</h3>
                <p className="text-black/40 text-sm">Farmers haven't listed any crops for auction yet.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-black/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-40">
            <Sprout size={16} />
            <span className="text-sm font-medium">AgriIntel v1.1</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-black/40">
            <a href="#" className="hover:text-emerald-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
