import { useState, useEffect } from "react";
import {
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  CheckCircle,
  FileText,
  Plus,
  Trash2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const SHEETS_URL = import.meta.env.VITE_GOOGLE_SHEETS_URL || "";

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
];

const CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Meat",
  "Fish",
  "Dairy",
  "Household",
  "ORE (Official Residence)",
  "Other",
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmtM(v) {
  return "\u20AB" + (v / 1000000).toFixed(1) + "M";
}

function fmtM2(v) {
  return "\u20AB" + (v / 1000000).toFixed(2) + "M";
}

function fmtVND(v) {
  return "\u20AB" + Math.round(v).toLocaleString();
}

function sendToSheets(data) {
  if (!SHEETS_URL) return;
  try {
    fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error("Sheets sync error:", err);
  }
}

// Fetch all receipts & transfers back from Google Sheets
async function loadFromSheets(setReceipts, setTransfers) {
  if (!SHEETS_URL) return;
  try {
    const res = await fetch(SHEETS_URL + "?action=getAll");
    if (!res.ok) return;
    const data = await res.json();
    if (data.receipts && data.receipts.length > 0) {
      setReceipts(prev => {
        const ids = new Set(prev.map(r => r.id));
        const merged = [...prev];
        data.receipts.forEach(r => { if (!ids.has(r.id)) merged.push(r); });
        return merged;
      });
    }
    if (data.transfers && data.transfers.length > 0) {
      setTransfers(prev => {
        const ids = new Set(prev.map(t => t.id));
        const merged = [...prev];
        data.transfers.forEach(t => { if (!ids.has(t.id)) merged.push(t); });
        return merged;
      });
    }
  } catch (e) {
    console.error("Failed to load from Sheets:", e);
  }
}

function emptyItem() {
  return { name: "", category: "Other", quantity: 1, unit_price: 0, total: 0 };
}

function emptyManual(user) {
  return {
    date: today(),
    store_name: "",
    original_store_name: "",
    items: [emptyItem()],
    notes: "",
    submitted_by: user,
    is_ore_expense: false,
  };
}

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        onUnlock(password);
      } else {
        setError("Wrong password. Please try again.");
      }
    } catch (err) {
      setError("Could not verify. Please try again.");
    }
    setChecking(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-slate-800/80 border border-slate-700/50">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Receipt Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">Enter password to continue</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />
          {error && (
            <p className="text-red-400 text-sm mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={checking || !password}
            className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold transition-colors"
          >
            {checking ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [newTransfer, setNewTransfer] = useState("");
  const [newTransferDate, setNewTransferDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [expandedReceipt, setExpandedReceipt] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [showRawTranslation, setShowRawTranslation] = useState({});
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [currentUser, setCurrentUser] = useState("Hahn");
  const [manualReceipt, setManualReceipt] = useState(emptyManual("Hahn"));
  const [ocrWarnings, setOcrWarnings] = useState({});


  // Load data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("receiptData");
    const savedTransfers = localStorage.getItem("transferData");
    if (saved) { try { setReceipts(JSON.parse(saved)); } catch(e) { console.error("Failed to load receipts", e); } }
    if (savedTransfers) { try { setTransfers(JSON.parse(savedTransfers)); } catch(e) { console.error("Failed to load transfers", e); } }
    // Then sync from Google Sheets for cross-device data
    loadFromSheets(setReceipts, setTransfers);
  }, []);

  // Persist receipts to localStorage
  useEffect(() => {
    if (receipts.length > 0) localStorage.setItem("receiptData", JSON.stringify(receipts));
  }, [receipts]);

  // Persist transfers to localStorage
  useEffect(() => {
    if (transfers.length > 0) localStorage.setItem("transferData", JSON.stringify(transfers));
  }, [transfers]);
  // ---- OCR: send image to our serverless API ----
  // OCR validation: detect missing or suspicious data
  const validateReceipt = (receiptData) => {
    const warnings = [];
    if (!receiptData.items || receiptData.items.length === 0) {
      warnings.push("No items detected - receipt may be blank or too faded");
    }
    if (receiptData.items && receiptData.items.length > 0) {
      const itemsTotal = receiptData.items.reduce((s, i) => s + (i.total || 0), 0);
      const reported = receiptData.total_vnd || 0;
      if (reported > 0 && Math.abs(itemsTotal - reported) > reported * 0.1) {
        warnings.push("Total mismatch: items=" + itemsTotal.toLocaleString() + " vs receipt=" + reported.toLocaleString() + " VND");
      }
      if (receiptData.items.some(i => !i.unit_price || i.unit_price === 0)) {
        warnings.push("Some items have no price - OCR may have missed pricing");
      }
      if (receiptData.items.some(i => !i.name || i.name.trim() === "")) {
        warnings.push("Some items have no name - text may be too faded");
      }
    }
    if (!receiptData.store_name || receiptData.store_name === "Unknown Store") {
      warnings.push("Store name not detected");
    }
    if (!receiptData.date) {
      warnings.push("Date not detected on receipt");
    }
    return warnings;
  };

  async function processReceipt(file) {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/process-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mediaType: file.type || "image/jpeg",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server error");
      }

      const parsed = await res.json();

      const newReceipt = {
        id: Date.now(),
        ...parsed,
        processed_at: new Date().toISOString(),
        submitted_by: currentUser,
      };

      // Run OCR validation
      const warnings = validateReceipt(newReceipt);
      if (warnings.length > 0) {
        setOcrWarnings(prev => ({...prev, [newReceipt.id]: warnings}));
      }
      setReceipts((prev) => [newReceipt, ...prev]);
      sendToSheets({...newReceipt, image_base64: base64});
    } catch (error) {
      alert("Error processing receipt: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // ---- Transfers ----
  function addTransfer() {
    if (!newTransfer) return;
    const transfer = {
      id: Date.now(),
      amount: parseFloat(newTransfer),
      date: newTransferDate,
      timestamp: new Date().toISOString(),
    };
    setTransfers((prev) => [transfer, ...prev]);
    setNewTransfer("");
    sendToSheets({ type: "transfer", ...transfer });
  }

  function deleteReceipt(id) {
    setReceipts(receipts.filter((r) => r.id !== id));
  }

  function deleteTransfer(id) {
    setTransfers(transfers.filter((t) => t.id !== id));
  }

  // ---- Manual entry helpers ----
  function addManualItem() {
    setManualReceipt({
      ...manualReceipt,
      items: [...manualReceipt.items, emptyItem()],
    });
  }

  function removeManualItem(idx) {
    setManualReceipt({
      ...manualReceipt,
      items: manualReceipt.items.filter((_, i) => i !== idx),
    });
  }

  function updateManualItem(idx, field, value) {
    const items = manualReceipt.items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        updated.total =
          parseFloat(updated.quantity) * parseFloat(updated.unit_price);
      }
      return updated;
    });
    setManualReceipt({ ...manualReceipt, items });
  }

  function submitManualReceipt() {
    if (!manualReceipt.store_name.trim()) {
      alert("Please enter store/market name");
      return;
    }
    if (manualReceipt.items.some((item) => !item.name.trim() || item.total === 0)) {
      alert("Please fill all items with name and valid price");
      return;
    }
    const totalVnd = manualReceipt.items.reduce(
      (sum, item) => sum + parseFloat(item.total || 0),
      0
    );
    const newReceipt = {
      id: Date.now(),
      date: manualReceipt.date,
      store_name: manualReceipt.store_name,
      original_store_name:
        manualReceipt.original_store_name || manualReceipt.store_name,
      items: manualReceipt.items,
      subtotal: totalVnd,
      tax: 0,
      total_vnd: totalVnd,
      raw_translation:
        manualReceipt.notes || "Manual entry - handwritten receipt from wet market",
      processed_at: new Date().toISOString(),
      is_manual: true,
      submitted_by: currentUser,
      is_ore_expense: manualReceipt.is_ore_expense,
    };
    setReceipts((prev) => [newReceipt, ...prev]);
    sendToSheets(newReceipt);
    setManualReceipt(emptyManual(currentUser));
    setShowManualEntry(false);
  }

  // ---- Calculations ----
  const monthlyReceipts = receipts.filter((r) =>
    r.date.startsWith(selectedMonth)
  );
  const monthlyTransfers = transfers.filter((t) =>
    t.date.startsWith(selectedMonth)
  );
  const totalTransferred = monthlyTransfers.reduce(
    (sum, t) => sum + t.amount,
    0
  );
  const totalSpent = monthlyReceipts.reduce(
    (sum, r) => sum + r.total_vnd,
    0
  );
  const balance = totalTransferred - totalSpent;

  const categoryBreakdown = {};
  monthlyReceipts.forEach((receipt) => {
    receipt.items.forEach((item) => {
      const cat = item.category || "Other";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + item.total;
    });
  });
  const categoryData = Object.entries(categoryBreakdown).map(
    ([name, value]) => ({ name, value: Math.round(value) })
  );

  const monthlyTrend = {};
  receipts.forEach((receipt) => {
    const month = receipt.date.slice(0, 7);
    monthlyTrend[month] = (monthlyTrend[month] || 0) + receipt.total_vnd;
  });
  const trendData = Object.entries(monthlyTrend)
    .sort()
    .map(([month, amount]) => ({ month, amount: Math.round(amount) }));

  // ---- Render ----
  if (!authed) {
    return (
      <PasswordGate
        onUnlock={(pw) => {
          setSessionPassword(pw);
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Receipt Manager
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Vietnamese Dong Household Tracking
              </p>
            </div>
            {SHEETS_URL && (
              <div className="text-xs sm:text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle size={16} />
                <span className="hidden sm:inline">Sheets Connected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* User Selector */}
        <div className="mb-6 p-4 rounded-lg bg-blue-900/20 border border-blue-700/50">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Current User
          </label>
          <div className="flex gap-3">
            {["Hahn", "Thuy"].map((name) => (
              <button
                key={name}
                onClick={() => setCurrentUser(name)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  currentUser === name
                    ? "bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/30"
                    : "bg-slate-700/50 border border-slate-600 text-slate-300 hover:border-slate-500"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Month Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-700/50">
            <h3 className="text-slate-400 font-medium text-xs sm:text-sm mb-2">
              Transferred
            </h3>
            <div className="text-xl sm:text-3xl font-bold text-blue-300">
              {fmtM(totalTransferred)}
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {monthlyTransfers.length} transfers
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-emerald-900/40 to-slate-900/40 border border-emerald-700/50">
            <h3 className="text-slate-400 font-medium text-xs sm:text-sm mb-2">
              Total Spent
            </h3>
            <div className="text-xl sm:text-3xl font-bold text-emerald-300">
              {fmtM(totalSpent)}
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {monthlyReceipts.length} receipts
            </p>
          </div>

          <div
            className={`p-4 sm:p-6 rounded-xl bg-gradient-to-br ${
              balance >= 0
                ? "from-cyan-900/40 to-slate-900/40 border border-cyan-700/50"
                : "from-red-900/40 to-slate-900/40 border border-red-700/50"
            }`}
          >
            <h3 className="text-slate-400 font-medium text-xs sm:text-sm mb-2">
              Balance
            </h3>
            <div
              className={`text-xl sm:text-3xl font-bold ${
                balance >= 0 ? "text-cyan-300" : "text-red-300"
              }`}
            >
              {fmtM(Math.abs(balance))}
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {balance >= 0 ? "Remaining" : "Overspent"}
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-purple-900/40 to-slate-900/40 border border-purple-700/50">
            <h3 className="text-slate-400 font-medium text-xs sm:text-sm mb-2">
              Per Receipt
            </h3>
            <div className="text-xl sm:text-3xl font-bold text-purple-300">
              {fmtM2(totalSpent / Math.max(monthlyReceipts.length, 1))}
            </div>
            <p className="text-slate-500 text-xs mt-1">Average</p>
          </div>
        </div>

        {/* Action Cards: Transfer + Upload + Manual */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Record Transfer */}
          <div className="p-5 sm:p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Plus size={18} />
              Record Transfer
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={newTransferDate}
                  onChange={(e) => setNewTransferDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Amount (VND)
                </label>
                <input
                  type="number"
                  placeholder="1000000"
                  value={newTransfer}
                  onChange={(e) => setNewTransfer(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={addTransfer}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Add Transfer
              </button>
            </div>
          </div>

          {/* Upload + Manual */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Photo Upload */}
            <div className="p-5 sm:p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Upload size={18} />
                Scan Receipt
              </h2>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => processReceipt(e.target.files?.[0])}
                  disabled={loading}
                  className="hidden"
                />
                <div
                  className={`px-4 py-8 rounded-lg border-2 border-dashed ${
                    loading
                      ? "border-slate-600 bg-slate-700/30"
                      : "border-blue-600/50 bg-blue-900/20 hover:bg-blue-900/30 cursor-pointer"
                  } transition-colors`}
                >
                  <div className="text-center">
                    <Upload
                      className={`mx-auto mb-2 ${
                        loading ? "text-slate-500 animate-pulse" : "text-blue-400"
                      }`}
                      size={24}
                    />
                    <p className="text-sm font-medium text-slate-200">
                      {loading ? "Processing..." : "Tap to take photo"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Auto-translates Vietnamese receipts
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Manual Entry */}
            <div className="p-5 sm:p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <FileText size={18} />
                Manual Entry
              </h2>
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="w-full px-4 py-8 rounded-lg border-2 border-dashed border-emerald-600/50 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
              >
                <div className="text-center">
                  <FileText className="mx-auto mb-2 text-emerald-400" size={24} />
                  <p className="text-sm font-medium text-slate-200">
                    {showManualEntry ? "Close form" : "Enter manually"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    For market purchases
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Manual Entry Form */}
        {showManualEntry && (
          <div className="mb-6 sm:mb-8 p-5 sm:p-6 rounded-xl bg-emerald-900/20 border border-emerald-700/50">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <FileText size={20} />
                Manual Receipt Entry
              </h2>
              <button
                onClick={() => setShowManualEntry(false)}
                className="text-slate-400 hover:text-slate-200 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* User + ORE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Who is uploading?
                  </label>
                  <div className="flex gap-2">
                    {["Hahn", "Thuy"].map((name) => (
                      <button
                        key={name}
                        onClick={() => setCurrentUser(name)}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                          currentUser === name
                            ? "bg-blue-600 text-white border border-blue-500"
                            : "bg-slate-700/50 border border-slate-600 text-slate-300"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    ORE Expense?
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setManualReceipt({
                          ...manualReceipt,
                          is_ore_expense: true,
                        })
                      }
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                        manualReceipt.is_ore_expense
                          ? "bg-amber-600 text-white border border-amber-500"
                          : "bg-slate-700/50 border border-slate-600 text-slate-300"
                      }`}
                    >
                      Yes (ORE)
                    </button>
                    <button
                      onClick={() =>
                        setManualReceipt({
                          ...manualReceipt,
                          is_ore_expense: false,
                        })
                      }
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                        !manualReceipt.is_ore_expense
                          ? "bg-slate-600 text-white border border-slate-500"
                          : "bg-slate-700/50 border border-slate-600 text-slate-300"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Store info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Market/Store (Vietnamese)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Chợ Hàng Da"
                    value={manualReceipt.original_store_name}
                    onChange={(e) =>
                      setManualReceipt({
                        ...manualReceipt,
                        original_store_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Store Name (English)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Hang Da Market"
                    value={manualReceipt.store_name}
                    onChange={(e) =>
                      setManualReceipt({
                        ...manualReceipt,
                        store_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={manualReceipt.date}
                  onChange={(e) =>
                    setManualReceipt({ ...manualReceipt, date: e.target.value })
                  }
                  className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Items */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  Items Purchased
                </h3>
                <div className="space-y-3">
                  {manualReceipt.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end p-3 sm:p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                    >
                      <div className="col-span-2 sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">
                          Item
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Tomatoes"
                          value={item.name}
                          onChange={(e) =>
                            updateManualItem(idx, "name", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Category
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) =>
                            updateManualItem(idx, "category", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateManualItem(
                              idx,
                              "quantity",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateManualItem(
                              idx,
                              "unit_price",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Total
                          </label>
                          <div className="px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 text-sm font-mono">
                            {Math.round(item.total).toLocaleString()}
                          </div>
                        </div>
                        {manualReceipt.items.length > 1 && (
                          <button
                            onClick={() => removeManualItem(idx)}
                            className="px-2 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-400"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addManualItem}
                  className="mt-3 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 text-slate-200 font-medium flex items-center gap-2"
                >
                  <Plus size={16} /> Add Item
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Total (VND)
                  </label>
                  <div className="px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-emerald-300 text-lg font-bold font-mono">
                    {fmtVND(
                      manualReceipt.items.reduce(
                        (sum, item) => sum + item.total,
                        0
                      )
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    placeholder="Optional notes..."
                    value={manualReceipt.notes}
                    onChange={(e) =>
                      setManualReceipt({
                        ...manualReceipt,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-12"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  onClick={submitManualReceipt}
                  className="flex-1 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle size={18} /> Save Receipt
                </button>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="p-5 sm:p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">
              Spending by Category
            </h2>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => fmtM(value)}
                    contentStyle={{
                      background: "#1E293B",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-500">
                No data for this month
              </div>
            )}
            <div className="mt-4 space-y-2">
              {categoryData.map((cat, idx) => (
                <div
                  key={cat.name}
                  className="flex justify-between items-center text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    />
                    <span className="text-slate-300">{cat.name}</span>
                  </div>
                  <span className="text-slate-400">{fmtM(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">
              Monthly Trend
            </h2>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="month" stroke="#94A3B8" />
                  <YAxis
                    stroke="#94A3B8"
                    tickFormatter={(v) => fmtM(v)}
                  />
                  <Tooltip
                    formatter={(value) => fmtM(value)}
                    contentStyle={{
                      background: "#1E293B",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ fill: "#3B82F6", r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Month Summary */}
        <div className="mb-6 sm:mb-8 p-5 sm:p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Month Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Reconciliation</span>
              <span
                className={`font-semibold ${
                  Math.abs(balance) < 100000
                    ? "text-emerald-400"
                    : "text-yellow-400"
                }`}
              >
                {Math.abs(balance) < 100000 ? "✓ Balanced" : "⚠ Check"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Variance</span>
              <span className="text-slate-300 font-mono">
                {fmtVND(balance)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Variance %</span>
              <span className="text-slate-300">
                {totalTransferred
                  ? ((balance / totalTransferred) * 100).toFixed(2)
                  : 0}
                %
              </span>
            </div>
            <hr className="border-slate-700" />
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Receipts</span>
              <span className="text-slate-300 font-semibold">
                {monthlyReceipts.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Transfers</span>
              <span className="text-slate-300 font-semibold">
                {monthlyTransfers.length}
              </span>
            </div>
          </div>
        </div>

        {/* Receipts List */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-4">
            Receipts ({monthlyReceipts.length})
          </h2>
          <div className="space-y-3">
            {monthlyReceipts.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center text-slate-400">
                No receipts for {selectedMonth}. Upload or enter one to start.
              </div>
            ) : (
              monthlyReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-700/30 flex justify-between items-center transition-colors"
                    onClick={() =>
                      setExpandedReceipt(
                        expandedReceipt === receipt.id ? null : receipt.id
                      )
                    }
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-blue-400" />
                        <div>
                          <h3 className="font-semibold text-slate-100">
                            {receipt.store_name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <p className="text-sm text-slate-400">
                              {receipt.date}
                            </p>
                            {receipt.is_manual && (
                              <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/50 border border-emerald-700 text-emerald-300">
                                Manual
                              </span>
                            )}
                            {receipt.submitted_by && (
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-700/50 border border-slate-600 text-slate-300">
                                by {receipt.submitted_by}
                              </span>
                            )}
                            {receipt.is_ore_expense && (
                              <span className="px-2 py-0.5 rounded text-xs bg-amber-900/50 border border-amber-700 text-amber-300">
                                ★ ORE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-slate-100">
                        {fmtM2(receipt.total_vnd)}
                      </p>
                      <p className="text-sm text-slate-400">
                        {receipt.items.length} items
                      </p>
                    </div>
                  </div>

                  {expandedReceipt === receipt.id && (
                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
                      <div className="space-y-4">
                        <div className="space-y-2">
                    {ocrWarnings[receipt.id] && ocrWarnings[receipt.id].length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
                          <AlertTriangle size={16} />
                          <span>OCR Warning</span>
                        </div>
                        {ocrWarnings[receipt.id].map((w, wi) => (
                          <p key={wi} className="text-amber-600 text-xs ml-6">{w}</p>
                        ))}
                        <p className="text-amber-500 text-xs ml-6 mt-1 italic">Check the original image in Google Drive</p>
                      </div>
                    )}
                          {receipt.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-sm text-slate-300 p-2 rounded bg-slate-800/30"
                            >
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-xs text-slate-500">
                                  {item.category} &bull; {item.quantity}
                                  {item.unit_price > 0
                                    ? ` @ ${fmtVND(item.unit_price)}`
                                    : ""}
                                </p>
                              </div>
                              <p className="font-mono">
                                {fmtVND(item.total)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-slate-700/50 pt-3">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Subtotal:</span>
                            <span className="text-slate-300">
                              {fmtVND(receipt.subtotal || receipt.total_vnd)}
                            </span>
                          </div>
                          {receipt.tax > 0 && (
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-slate-400">Tax:</span>
                              <span className="text-slate-300">
                                {fmtVND(receipt.tax)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-200">Total:</span>
                            <span className="text-blue-300">
                              {fmtVND(receipt.total_vnd)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            setShowRawTranslation({
                              ...showRawTranslation,
                              [receipt.id]: !showRawTranslation[receipt.id],
                            })
                          }
                          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300"
                        >
                          {showRawTranslation[receipt.id] ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                          {showRawTranslation[receipt.id] ? "Hide" : "Show"}{" "}
                          translation
                        </button>

                        {showRawTranslation[receipt.id] && (
                          <div className="p-3 rounded bg-slate-900/50 border border-slate-700/30">
                            <p className="text-xs text-slate-400 whitespace-pre-wrap">
                              {receipt.raw_translation}
                            </p>
                          </div>
                        )}

                        <button
                          onClick={() => deleteReceipt(receipt.id)}
                          className="w-full mt-2 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transfers List */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-4">
            Transfers ({monthlyTransfers.length})
          </h2>
          <div className="space-y-2">
            {monthlyTransfers.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center text-slate-400">
                No transfers for {selectedMonth}.
              </div>
            ) : (
              monthlyTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
                      <RefreshCw size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-100">
                        {transfer.date}
                      </p>
                      <p className="text-xs text-slate-400">VND Transfer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-blue-300">
                      +{fmtM2(transfer.amount)}
                    </span>
                    <button
                      onClick={() => deleteTransfer(transfer.id)}
                      className="p-2 rounded-lg hover:bg-red-900/20 text-red-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
