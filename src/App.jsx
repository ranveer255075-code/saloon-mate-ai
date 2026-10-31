import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, Receipt, Users, Scissors, Wallet, Package, LogOut, Plus, Minus, Trash2, Printer, X, CheckCircle, Clock, TrendingUp, DollarSign, MapPin, Mail, Phone, Tag, Star, Gift, Briefcase, Lock, User, RefreshCw, History, Eye, Settings, Pencil, Save, CreditCard, MessageCircle, Send, ClipboardList, Bot
} from 'lucide-react';

// --- API CONFIG ---
const API_URL = "http://localhost/renu-api/index.php";
// Override this when the AI API is hosted elsewhere (for example in .env:
// VITE_AI_API_URL=https://api.example.com).  The local default matches the
// `npm run ai` command below.
const AI_API_URL = import.meta.env.VITE_AI_API_URL || "http://127.0.0.1:8000";

// --- RAZORPAY CONFIG ---
const RAZORPAY_KEY_ID = 'rzp_test_RjIFMTW7FeLJmS'; 

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-checkout-js')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Razorpay SDK failed to load.");
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

const authAction = async (action, data) => {
    try {
        const res = await fetch(`${API_URL}?type=auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        return await res.json();
    } catch (err) {
        console.error("Auth API Network Error:", err);
        return { success: false, message: "Network Error. Check XAMPP/PHP API." };
    }
};

// --- SAFE JSON PARSER (PREVENTS WHITE SCREEN) ---
const safeJSONParse = (jsonString) => {
    try {
        if (!jsonString) return [];
        if (typeof jsonString === 'object') return jsonString; 
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn("Failed to parse JSON:", jsonString, e);
        return []; 
    }
};

// --- MODALS & COMPONENTS ---
const ForgotPasswordModal = ({ onLogin, onBack }) => {
  const [stage, setStage] = useState('username'); 
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await authAction('forgot_question', { username });
    if (result.success && result.question) {
      setQuestion(result.question);
      setStage('question');
    } else {
      setError(result.message || 'Username not found or Security Question not set.');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if(newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
    }
    const result = await authAction('reset_password', { username, answer, newPassword });
    if (result.success) {
      alert(result.message + ' Please login.');
      onBack(); 
    } else {
      setError(result.message || 'Password reset failed. Incorrect answer.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-96 relative">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Forgot Password</h3>
        
        {stage === 'username' && (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">Enter your username to proceed.</p>
            <input type="text" placeholder="Username" className="w-full p-2.5 border rounded-lg text-gray-800" value={username} onChange={(e) => setUsername(e.target.value)} required />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-[#c08081] text-white py-2 rounded-lg hover:bg-[#a86b6c] transition-colors">Next</button>
          </form>
        )}
        
        {stage === 'question' && (
          <form onSubmit={(e) => {e.preventDefault(); setStage('reset');}} className="space-y-4">
            <p className="font-bold text-gray-700">Security Question:</p>
            <p className="text-sm text-red-600 font-medium">{question}</p>
            <input type="text" placeholder="Your Answer" className="w-full p-2.5 border rounded-lg text-gray-800" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
            <button type="submit" className="w-full bg-[#c08081] text-white py-2 rounded-lg hover:bg-[#a86b6c] transition-colors">Verify Answer</button>
          </form>
        )}

        {stage === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">Enter new password:</p>
            <input type="password" placeholder="New Password" className="w-full p-2.5 border rounded-lg text-gray-800" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <input type="password" placeholder="Confirm Password" className="w-full p-2.5 border rounded-lg text-gray-800" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition-colors">Reset Password</button>
          </form>
        )}
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 mt-4 block mx-auto font-medium">Back to Login</button>
      </div>
    </div>
  );
};

const Login = ({ onLogin, onCustomerPortal }) => {
  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [registerMode, setRegisterMode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const result = await authAction('login', { username, password });
    if (result.success) {
      onLogin(result.username, result.has_security_question);
    } else {
      setError(result.message || 'Invalid Username or Password');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    const result = await authAction('register', {
      username, password, security_question: securityQuestion, security_answer: securityAnswer
    });
    if (result.success) {
      onLogin(result.username, true);
    } else {
      setError(result.message || 'Could not create the staff account.');
    }
  };

  const switchMode = (isRegistering) => {
    setRegisterMode(isRegistering);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  if (showForgotModal) {
    return <ForgotPasswordModal onLogin={onLogin} onBack={() => setShowForgotModal(false)} />;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-[400px] border-t-4 border-[#c08081]">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-[#c08081] tracking-tight">SALON <span className="text-gray-800">ERP</span></h1>
            <p className="text-sm text-gray-500 font-medium mt-1">{registerMode ? 'Create Staff Account' : 'Admin Portal Login'}</p>
        </div>
        <form onSubmit={registerMode ? handleRegister : handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Username</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-3 text-gray-400"/>
              <input type="text" placeholder="admin" className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c08081] outline-none text-gray-800 transition-shadow" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3 text-gray-400"/>
              <input type="password" placeholder="••••••••" className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c08081] outline-none text-gray-800 transition-shadow" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          {registerMode && <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Confirm Password</label>
              <input type="password" minLength="8" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c08081] outline-none text-gray-800" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Security Question</label>
              <input type="text" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c08081] outline-none text-gray-800" value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Security Answer</label>
              <input type="text" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c08081] outline-none text-gray-800" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} required />
            </div>
          </>}
          {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-md">{error}</p>}
          <button type="submit" className="w-full bg-[#c08081] text-white py-3 rounded-lg font-bold hover:bg-[#a86b6c] transition-colors shadow-sm">{registerMode ? 'Create Staff Account' : 'Secure Login'}</button>
        </form>
        <div className="mt-6 text-center">
            {!registerMode && <button type="button" onClick={() => setShowForgotModal(true)} className="text-sm text-[#c08081] hover:text-[#a86b6c] font-medium transition-colors">Forgot Password?</button>}
            <button type="button" onClick={() => switchMode(!registerMode)} className="mt-3 block w-full text-sm text-[#c08081] hover:text-[#a86b6c] font-bold transition-colors">
                {registerMode ? 'Already have a staff account? Sign in' : 'New staff member? Create an account'}
            </button>
            <button type="button" onClick={onCustomerPortal} className="mt-3 block w-full text-sm text-purple-700 hover:text-purple-900 font-bold transition-colors">
                Customer? Open SalonMate Portal →
            </button>
        </div>
      </div>
    </div>
  );
};

const ProfileSettingsModal = ({ username, hasSecurityQuestion, onClose, refreshApp }) => {
    const [oldPassword, setOldPassword] = useState(''); 
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSave = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (newPassword) {
            if (!oldPassword) return setError('Please enter your old password to set a new one.');
            if (newPassword !== confirmPassword) return setError('New passwords do not match.');
        }
        if ((securityQuestion || securityAnswer) && (!securityQuestion || !securityAnswer)) return setError('Both Security Question and Answer must be set.');

        const data = { username, new_password: newPassword, old_password: oldPassword, security_question: securityQuestion, security_answer: securityAnswer };
        const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => {
            if ((key === 'new_password' || key === 'old_password') && !newPassword) return false;
            return true;
        }));
        
        filteredData.username = username;
        if (securityQuestion) filteredData.security_question = securityQuestion;
        if (securityAnswer) filteredData.security_answer = securityAnswer;

        if(Object.keys(filteredData).length <= 1 && !newPassword) return setError("No changes detected.");

        const result = await authAction('update_profile', filteredData);
        if (result.success) {
            setSuccess('Profile updated successfully!');
            setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setSecurityQuestion(''); setSecurityAnswer('');
            refreshApp(); 
        } else {
            setError(result.message || 'Update failed.');
        }
    };

    const questions = [
        "What is your mother's maiden name?", "What was the name of your first pet?", "What city were you born in?", "What is the name of your favorite book?", "What is the name of your first school?",
    ];

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative border border-gray-100">
                <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-3 flex justify-between items-center">
                    Admin Security Settings
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-md transition-colors"><X size={20}/></button>
                </h3>
                {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4 font-medium flex items-center gap-2"><CheckCircle size={16}/> {success}</div>}
                {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 font-medium flex items-center gap-2"><X size={16}/> {error}</div>}

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-4 border border-gray-200 p-5 rounded-xl bg-gray-50">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2"><Lock size={16} className="text-gray-500"/> Change Password</h4>
                        <input type="password" placeholder="Old Password (Required to change)" className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                        <input type="password" placeholder="New Password" className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        <input type="password" placeholder="Confirm New Password" className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                    <div className="space-y-4 border border-yellow-200 p-5 rounded-xl bg-yellow-50/30">
                        <h4 className="font-bold text-yellow-800 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Tag size={16}/> Recovery Question</span>
                            {!hasSecurityQuestion && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200">Action Required</span>}
                        </h4>
                        <select className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-yellow-400 outline-none" value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}>
                            <option value="">-- Select Security Question --</option>
                            {questions.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                        <input type="text" placeholder="Your Secret Answer" className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-400 outline-none" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                        <button type="submit" className="w-full bg-[#c08081] text-white py-3 rounded-lg font-bold hover:bg-[#a86b6c] transition-colors shadow-sm">Save Security Settings</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AppointmentDetailsModal = ({ appointment, onClose }) => {
  if (!appointment) return null;
  const DetailItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <Icon size={20} className="text-[#c08081]"/>
      <div><p className="text-xs font-medium text-gray-500">{label}</p><p className="font-bold text-gray-800">{value || 'N/A'}</p></div>
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg relative border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3 flex justify-between items-center">
            Customer Details <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-1.5 rounded-md"><X size={20}/></button>
        </h3>
        <div className="space-y-4">
          <DetailItem icon={User} label="Name" value={appointment.customer} />
          <DetailItem icon={Phone} label="Phone Number" value={appointment.phone} />
          <DetailItem icon={Mail} label="Email" value={appointment.email} />
          <DetailItem icon={MapPin} label="Address" value={appointment.address} />
          <DetailItem icon={Tag} label="Booking Source" value={appointment.source} />
        </div>
        <div className="mt-6 pt-4 border-t border-gray-100">
            <button onClick={onClose} className="w-full bg-gray-800 text-white py-2.5 rounded-lg hover:bg-black transition font-bold">Close Window</button>
        </div>
      </div>
    </div>
  );
};

// --- SALONMATE AI CHAT ---
// The AI service runs separately at FastAPI port 8000, keeping the Gemini key
// off the browser and out of this React application.
const getOfflineSalonReply = (message) => {
  const question = message.toLowerCase();
  if (/(book|appointment|slot|schedule|time)/.test(question)) {
    return 'Demo mode: I can help collect a booking. Please share your name, mobile number, service, preferred date and time. An administrator must confirm availability before the appointment is created.';
  }
  if (/(price|cost|rate|offer|discount)/.test(question)) {
    return 'Demo mode: service pricing and current offers should be confirmed by the salon. Add your real service prices and offers to the SalonMate knowledge base to let the AI answer this accurately.';
  }
  if (/(hair|facial|skin|spa|manicure|pedicure)/.test(question)) {
    return 'Demo mode: SalonMate can help with haircuts, hair spa, facials, manicures and pedicures. Tell me your goal and budget, and the full AI version can recommend suitable services.';
  }
  if (/(hello|hi|hey)/.test(question)) {
    return 'Hello! I am SalonMate AI in offline demo mode. I can answer salon FAQs and collect appointment details. Connect a Gemini API key later to enable live AI responses.';
  }
  return 'Demo mode: I understand this is a salon-related question. Add the Gemini key later for a full AI answer, or ask me about bookings, services, hair care, facials, or prices.';
};

const SalonMateChat = ({ authToken = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am SalonMate AI. Ask me about salon services, offers, or booking an appointment.' }
  ]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;
    // Keep enough conversation context for a booking spread across several
    // messages; the backend caps this at 50 messages.
    const history = messages.slice(-40);
    setMessages(previous => [...previous, { role: 'user', content: text }]);
    setMessage('');
    setIsSending(true);
    try {
      const response = await fetch(`${AI_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ message: text, history })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'AI service is unavailable.');
      setMessages(previous => [...previous, { role: 'assistant', content: data.reply, action: data.agent_action }]);
    } catch (error) {
      // Do not disguise a backend/provider failure as a generic demo answer.
      // A clear message lets staff fix the API key or start the service.
      const reason = error?.message || 'The SalonMate service is unavailable.';
      setMessages(previous => [...previous, { role: 'assistant', content: `SalonMate could not answer right now: ${reason} Please try again after the AI backend and Gemini configuration are available.` }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-40">
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[#c08081] px-4 py-3 text-white">
            <div className="flex items-center gap-2 font-bold"><MessageCircle size={19}/> SalonMate AI</div>
            <button onClick={() => setIsOpen(false)} className="rounded p-1 hover:bg-white/20" aria-label="Close AI chat"><X size={18}/></button>
          </div>
          <div className="h-80 space-y-3 overflow-y-auto bg-rose-50/30 p-4">
            {messages.map((item, index) => (
              <div key={index} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${item.role === 'user' ? 'ml-auto bg-[#c08081] text-white' : 'bg-white text-gray-700 shadow-sm border border-gray-100'}`}>
                {item.content}
                {item.action === 'booking_request_created' && <div className="mt-2 text-xs font-bold text-green-700">Booking request sent for admin approval.</div>}
              </div>
            ))}
            {isSending && <div className="w-fit rounded-xl bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">SalonMate is thinking...</div>}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-100 p-3">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask SalonMate..." className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c08081]" />
            <button disabled={isSending} className="rounded-lg bg-[#c08081] p-2.5 text-white disabled:opacity-50" aria-label="Send message"><Send size={18}/></button>
          </form>
        </div>
      )}
      <button onClick={() => setIsOpen(open => !open)} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c08081] text-white shadow-lg shadow-rose-200 transition hover:scale-105" aria-label="Open SalonMate AI chat">
        {isOpen ? <X size={24}/> : <MessageCircle size={24}/>} 
      </button>
    </div>
  );
};

// --- CUSTOMER PORTAL ---
// This uses the customer-auth endpoints from the FastAPI backend. It is kept
// separate from the staff/admin ERP login so customers can only see their own
// AI-created booking requests.
const CustomerPortal = ({ onBack }) => {
  const storageKey = 'salonmate_customer_session';
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; }
  });
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${session?.token}` });

  const loadBookings = async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const response = await fetch(`${AI_API_URL}/api/customer/bookings`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not load bookings.');
      setBookings(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'Customer service is offline. Please run "npm run ai" and try again.'
        : (requestError.message || 'Customer service is unavailable.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBookings(); }, [session?.token]);

  const submitAuth = async (event) => {
    event.preventDefault();
    setError(''); setNotice(''); setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/customer-auth/register' : '/api/customer-auth/login';
      const payload = mode === 'register' ? form : { email: form.email, password: form.password };
      const response = await fetch(`${AI_API_URL}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to continue.');
      const nextSession = { token: data.token, customer: data.customer };
      localStorage.setItem(storageKey, JSON.stringify(nextSession));
      setSession(nextSession);
      setNotice(mode === 'register' ? 'Account created successfully.' : 'Welcome back.');
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'Customer service is offline. Please run "npm run ai" and try again.'
        : (requestError.message || 'Customer service is unavailable.'));
    } finally { setLoading(false); }
  };

  const logout = () => { localStorage.removeItem(storageKey); setSession(null); setBookings([]); setNotice(''); setError(''); };

  if (!session) return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-purple-50 p-5 text-gray-800 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-7 shadow-xl">
        <button onClick={onBack} className="mb-5 text-sm font-bold text-gray-500 hover:text-[#c08081]">← Back to staff login</button>
        <div className="mb-6"><div className="mb-3 inline-flex rounded-xl bg-rose-50 p-3 text-[#c08081]"><Scissors size={26}/></div><h1 className="text-2xl font-extrabold">SalonMate Customer Portal</h1><p className="mt-1 text-sm text-gray-500">Manage your AI booking requests and chat with the salon.</p></div>
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1"><button onClick={() => { setMode('login'); setError(''); }} className={`rounded-md py-2 text-sm font-bold ${mode === 'login' ? 'bg-white text-[#c08081] shadow-sm' : 'text-gray-500'}`}>Sign in</button><button onClick={() => { setMode('register'); setError(''); }} className={`rounded-md py-2 text-sm font-bold ${mode === 'register' ? 'bg-white text-[#c08081] shadow-sm' : 'text-gray-500'}`}>Create account</button></div>
        <form onSubmit={submitAuth} className="space-y-4">
          {mode === 'register' && <><input required minLength="2" placeholder="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-[#c08081]"/><input required pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-[#c08081]"/></>}
          <input required type="email" placeholder="Email address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-[#c08081]"/>
          <input required minLength="6" type="password" placeholder="Password (minimum 6 characters)" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-[#c08081]"/>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-[#c08081] py-3 font-bold text-white shadow-sm hover:bg-[#a86b6c] disabled:opacity-60">{loading ? 'Please wait…' : mode === 'register' ? 'Create customer account' : 'Sign in to portal'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 md:p-8 text-gray-800">
      <main className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm border border-gray-100"><div><p className="text-sm font-bold text-[#c08081]">SALONMATE</p><h1 className="text-2xl font-extrabold">Hello, {session.customer.name}</h1><p className="text-sm text-gray-500">View your requests or chat to make a new booking.</p></div><div className="flex gap-2"><button onClick={loadBookings} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"><RefreshCw size={15} className="mr-1 inline"/> Refresh</button><button onClick={logout} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-black">Sign out</button></div></header>
        {notice && <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">My booking requests</h2><p className="text-sm text-gray-500">Requests are confirmed by the salon after availability is checked.</p></div><ClipboardList className="text-[#c08081]"/></div>
          <div className="grid gap-3 md:grid-cols-2">{bookings.map(booking => <div key={booking.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex justify-between gap-2"><p className="font-bold">{booking.service}</p><span className={`rounded-full px-2 py-1 text-xs font-bold ${booking.status === 'Confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'Declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{booking.status}</span></div><p className="mt-2 text-sm text-gray-600"><Calendar size={15} className="mr-1 inline"/>{booking.preferred_date} at {booking.preferred_time}</p></div>)}{!loading && bookings.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 p-7 text-center text-sm text-gray-500 md:col-span-2">No requests yet. Open SalonMate chat below to request an appointment.</div>}{loading && <div className="p-6 text-center text-sm text-gray-500 md:col-span-2">Loading your bookings…</div>}</div>
        </section>
        <section className="mt-6 rounded-2xl border border-purple-100 bg-purple-50 p-5"><h2 className="font-extrabold text-purple-900">Need an appointment?</h2><p className="mt-1 text-sm text-purple-800">Use the SalonMate chat button in the bottom-right. Your name and mobile number are already linked to this account.</p></section>
      </main>
      <SalonMateChat authToken={session.token}/>
    </div>
  );
};

const BarChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400">No Data</div>;
  const max = Math.max(...data);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="flex flex-col h-48 pt-4">
      <div className="flex flex-1 items-end justify-around border-l border-b border-gray-200">
        {data.map((value, index) => {
          const height = value === 0 ? 0 : Math.max(5, (value / (max || 1)) * 90);
          return (
            <div key={index} className="group flex flex-col items-center justify-end w-1/8 h-full relative">
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2.5 py-1 rounded-md z-10 whitespace-nowrap shadow-md">₹{value.toLocaleString()}</div>
              <div style={{ height: `${height}%` }} className="w-6 bg-[#c08081] rounded-t-sm shadow-sm transition-all duration-300 hover:bg-[#a86b6c] cursor-pointer"></div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-around text-xs font-medium text-gray-500 pt-2">
        {days.map((day, index) => (<span key={index} className="w-1/8 text-center">{day}</span>))}
      </div>
    </div>
  );
};

const InvoiceReceipt = ({ data, items, calculations, onClose }) => {
  return (
    <div className="bg-white p-8 max-w-md mx-auto border border-gray-200 shadow-2xl relative text-gray-800 print:shadow-none print:border-none">
       <div className="text-center border-b-2 border-gray-800 pb-5 mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 uppercase tracking-widest">SALON MANAGEMENT SYSTEM</h1>
          <p className="text-gray-600 font-medium mt-2 text-sm">Shop No. 12, Main Market, Maihar, MP - 485771</p>
          <p className="text-gray-500 text-sm mt-1">Ph: 07674-234567 | Email: contact@salon.com</p>
       </div>
       <div className="flex justify-between text-sm mb-6">
         <div className="w-2/3 pr-4">
           <p className="font-bold text-gray-700 border-b border-gray-300 inline-block mb-1">Billed To:</p>
           <p className="font-bold text-lg text-gray-900 uppercase">{data.customerName}</p>
           <p className="text-gray-600 font-medium">Ph: {data.customerPhone}</p>
         </div>
         <div className="text-right">
           <p className="font-bold text-gray-800">Invoice #: INV-{Math.floor(Math.random() * 10000)}</p>
           <p className="text-gray-600 font-medium">{new Date().toLocaleDateString()}</p>
           <p className="text-xs bg-gray-100 inline-block px-2 py-0.5 rounded mt-1 font-bold text-gray-600">{data.paymentMode}</p>
         </div>
       </div>
       <table className="w-full text-sm mb-4 text-left border-collapse">
         <thead>
           <tr className="border-b-2 border-gray-800 text-gray-700">
             <th className="py-2 font-bold">Service Item</th>
             <th className="text-center py-2 font-bold">Qty</th>
             <th className="text-right py-2 font-bold">Price</th>
             <th className="text-right py-2 font-bold">Total</th>
           </tr>
         </thead>
         <tbody>
           {items.map((item, idx) => (
             <tr key={idx} className="border-b border-dashed border-gray-300">
               <td className="py-2.5 font-medium">{item.name}</td>
               <td className="text-center py-2.5">{item.qty}</td>
               <td className="text-right py-2.5">₹{item.price}</td>
               <td className="text-right py-2.5 font-bold">₹{item.price * item.qty}</td>
             </tr>
           ))}
         </tbody>
       </table>
       <div className="border-t-2 border-gray-800 pt-3 space-y-1">
         <div className="flex justify-between text-sm text-gray-600 font-medium"><span>Subtotal:</span><span>₹{calculations.subtotal}</span></div>
         {calculations.discountAmt > 0 && <div className="flex justify-between text-sm text-rose-500 font-medium"><span>Discount ({data.discount}%):</span><span>- ₹{calculations.discountAmt}</span></div>}
         {calculations.taxAmt > 0 && <div className="flex justify-between text-sm text-gray-600 font-medium"><span>Tax ({data.tax}%):</span><span>+ ₹{calculations.taxAmt}</span></div>}
         <div className="flex justify-between text-xl font-extrabold mt-2 pt-2 border-t border-gray-300 text-gray-900">
           <span>Grand Total:</span>
           <span>₹{calculations.grandTotal}</span>
         </div>
       </div>
       <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
          <p className="font-bold mb-1">Thank you for your visit!</p>
          <p>No refunds on services. Please visit again.</p>
       </div>
       <div className="mt-6 flex gap-3 no-print">
          <button onClick={() => window.print()} className="flex-1 bg-gray-800 text-white py-3 rounded-lg hover:bg-black flex items-center justify-center gap-2 transition font-bold shadow-sm"><Printer size={18} /> Print Bill</button>
          <button onClick={onClose} className="flex-1 border-2 border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition font-bold text-gray-700">Close</button>
       </div>
    </div>
  );
};

// --- MOCK DATA FALLBACKS ---
const INITIAL_SERVICES = [
  { id: 1, name: 'Hair Cut (Standard)', category: 'Hair', price: 250, duration: '30 mins' },
  { id: 2, name: 'Facial (Gold)', category: 'Skin', price: 1200, duration: '1 hr' },
];

// --- MAIN APP ---
export default function App() {
  const [portalMode, setPortalMode] = useState('admin');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('Admin');
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receiptStatuses, setReceiptStatuses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [aiBookingRequests, setAiBookingRequests] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState(['Utilities', 'Pantry', 'Inventory', 'Rent', 'Maintenance']);
  const [loading, setLoading] = useState(false);

  // Forms
  const [aptForm, setAptForm] = useState({ customer: '', phone: '', email: '', address: '', selectedServiceId: '', addedServices: [], staffId: '', date: '', time: '', source: 'Walk-in' });
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null); 
  const [custForm, setCustForm] = useState({ id: null, name: '', phone: '', dob: '', isVip: 0, vipNotes: '' }); 
  const [editingExpense, setEditingExpense] = useState(null); 
  const [expenseForm, setExpenseForm] = useState({ id: null, title: '', amount: '', category: '' }); 
  const [isCustomCategory, setIsCustomCategory] = useState(false); 
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', role: '', commissionRate: 0 });
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', category: 'Hair', price: '', duration: '' });
  
  // Billing
  const [selectedBillingServiceId, setSelectedBillingServiceId] = useState(''); 
  const [billItems, setBillItems] = useState([]);
  const [billMeta, setBillMeta] = useState({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', discount: 0, tax: 18, paymentMode: 'Cash', staffId: '' });
  const [showReceipt, setShowReceipt] = useState(false);
  const automaticReceiptAppointments = useRef(new Set());
  
  // Modals
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Reports
  const [reportTimeframe, setReportTimeframe] = useState('Daily');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  
  useEffect(() => { loadRazorpayScript(); }, []);

  const fetchData = async (endpoint, setter) => {
    try {
      const res = await fetch(`${API_URL}?type=${endpoint}`);
      const data = await res.json();
      if (Array.isArray(data)) setter(data);
    } catch (err) { console.warn(`API ${endpoint} Offline. Using local state.`); }
  };

  const fetchAiBookingRequests = async () => {
    try {
      const response = await fetch(`${AI_API_URL}/api/booking-requests`);
      if (response.ok) setAiBookingRequests(await response.json());
    } catch (error) { console.warn('SalonMate AI booking queue is offline.'); }
  };

  const fetchReceiptStatuses = async () => {
    try {
      const response = await fetch(`${AI_API_URL}/api/automation/invoice-statuses`);
      if (response.ok) setReceiptStatuses(await response.json());
    } catch (error) { console.warn('Receipt archive is offline.'); }
  };

  const refreshAllData = () => {
    setLoading(true);
    Promise.all([
      fetchData('services', setServices),
      fetchData('staff', setStaff),
      fetchData('customers', setCustomers),
      fetchData('expenses', setExpenses),
      fetchData('appointments', setAppointments),
      fetchData('invoices', setInvoices),
      fetchData('inventory', setInventory),
      fetchAiBookingRequests(),
      fetchReceiptStatuses(),
    ]).then(() => setLoading(false));
  };

  useEffect(() => { if (isAuthenticated) refreshAllData(); }, [isAuthenticated]);
  useEffect(() => { if (isAuthenticated && activeTab === 'ai-bookings') fetchAiBookingRequests(); }, [activeTab, isAuthenticated]);

  const apiAction = async (method, endpoint, data = null, id = null) => {
    try {
      let url = `${API_URL}?type=${endpoint}`;
      if (id) url += `&id=${id}`;
      const options = { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : null };
      const res = await fetch(url, options);
      const result = await res.json();
      if (result.success) {
        refreshAllData(); 
        return true;
      } else {
        alert("Error: " + JSON.stringify(result));
        return false;
      }
    } catch (err) {
      console.warn("Local Action Triggered.");
      return endpoint === 'payment' ? false : true; // Never fake a successful payment.
    }
  };

  const handleLogin = (username, hasSecurityQuestion) => { setIsAuthenticated(true); setCurrentUser(username); setHasSecurityQuestion(hasSecurityQuestion); };
  const handleLogout = () => { setIsAuthenticated(false); setCurrentUser(''); setHasSecurityQuestion(false); };

  // Handlers (Expenses, Staff, Services, Inventory, Customers)
  const handleSaveExpense = async (e) => { e.preventDefault(); let finalCategory = expenseForm.category; if (finalCategory === 'Other' && document.getElementById('custom_category')?.value) { finalCategory = document.getElementById('custom_category').value; if (!expenseCategories.includes(finalCategory)) setExpenseCategories(prev => [...prev, finalCategory]); } if (!finalCategory) finalCategory = 'Miscellaneous'; const payload = { id: expenseForm.id, title: expenseForm.title, amount: parseFloat(expenseForm.amount), category: finalCategory, date: expenseForm.date || new Date().toISOString().split('T')[0] }; if(await apiAction('POST', 'expenses', payload)) { handleCancelExpenseForm(); } };
  const handleEditExpense = (expense) => { setEditingExpense(expense.id); setExpenseForm({ id: expense.id, title: expense.title, amount: expense.amount, category: expense.category, date: expense.date }); setIsCustomCategory(!expenseCategories.includes(expense.category)); };
  const handleCancelExpenseForm = () => { setEditingExpense(null); setExpenseForm({ id: null, title: '', amount: '', category: 'Utilities' }); setIsCustomCategory(false); };
  const handleDeleteExpense = (id) => { if(confirm("Delete expense?")) apiAction('DELETE', 'expenses', null, id); };
  const handleSaveStaff = async (e) => { e.preventDefault(); const payload = editingStaff ? { id: editingStaff, ...staffForm } : staffForm; if(await apiAction('POST', 'staff', payload)) { setEditingStaff(null); setStaffForm({ name: '', role: '', commissionRate: 0 }); } };
  const handleDeleteStaff = (id) => { if(confirm("Delete staff?")) apiAction('DELETE', 'staff', null, id); };
  const handleSaveService = async (e) => { e.preventDefault(); const payload = editingService ? { id: editingService, ...serviceForm } : serviceForm; if(await apiAction('POST', 'services', payload)) { setEditingService(null); setServiceForm({ name: '', category: 'Hair', price: '', duration: '' }); } };
  const handleDeleteService = (id) => { if(confirm("Delete service?")) apiAction('DELETE', 'services', null, id); };
  const handleAddInventory = async (e) => { e.preventDefault(); const fd = new FormData(e.target); const payload = { name: fd.get('name'), price: parseFloat(fd.get('price')), qty: parseInt(fd.get('qty')) }; if(await apiAction('POST', 'inventory', payload)) e.target.reset(); };
  const handleUpdateStock = (id, newQty) => { apiAction('POST', 'inventory', { id, qty: Math.max(0, newQty) }); };
  const handleDeleteInventory = (id) => { if(confirm("Delete item?")) apiAction('DELETE', 'inventory', null, id); };
  const handleSaveCustomer = async (e) => { e.preventDefault(); const payload = { ...custForm, isVip: custForm.isVip ? 1 : 0 }; if(await apiAction('POST', 'customers', payload)) { setShowCustomerForm(false); setEditingCustomer(null); setCustForm({ id: null, name: '', phone: '', dob: '', isVip: 0, vipNotes: '' }); } };
  const handleEditCustomer = (customer) => { setEditingCustomer(customer.id); setCustForm({ id: customer.id, name: customer.name, phone: customer.phone, dob: customer.dob, isVip: customer.isVip, vipNotes: customer.vipNotes }); setShowCustomerForm(true); };
  const handleDeleteCustomer = (id) => { if(confirm("Delete customer?")) apiAction('DELETE', 'customers', null, id); };
  const handleCancelCustomerForm = () => { setShowCustomerForm(false); setEditingCustomer(null); setCustForm({ id: null, name: '', phone: '', dob: '', isVip: 0, vipNotes: '' }); };

  // Appointment Handlers
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if(aptForm.addedServices.length === 0) return alert("Select at least 1 service.");
    const payload = { customer: aptForm.customer, phone: aptForm.phone, email: aptForm.email, address: aptForm.address, source: aptForm.source, staffId: aptForm.staffId, date: aptForm.date, time: aptForm.time, status: 'Pending', services_json: JSON.stringify(aptForm.addedServices) };
    
    const success = await apiAction('POST', 'appointments', payload);
    if(success) {
      if(!API_URL.includes("localhost")) {
         setAppointments([{ id: Date.now(), ...payload, services_json: JSON.stringify(aptForm.addedServices) }, ...appointments]);
      }
      setAptForm({ customer: '', phone: '', email: '', address: '', selectedServiceId: '', addedServices: [], staffId: '', date: '', time: '', source: 'Walk-in' });
      alert("Appointment Booked!");
    }
  };

  const notifyReceiptAutomation = async (receipt) => {
    try {
      const response = await fetch(`${AI_API_URL}/api/automation/invoice-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt),
      });
      const result = await response.json();
      return response.ok || response.status === 202
        ? result
        : { email_status: 'FAILED', error: result.detail || 'Receipt automation request failed.' };
    } catch (error) {
      // n8n delivery must never make a successful ERP payment look failed.
      return { email_status: 'FAILED', error: 'Receipt automation service is unavailable.' };
    }
  };
  const generateReceiptForCompletedAppointment = async (appointment) => {
    const guardKey = String(appointment.id);
    if (automaticReceiptAppointments.current.has(guardKey)) return;
    automaticReceiptAppointments.current.add(guardKey);

    const savedItems = safeJSONParse(appointment.services_json);
    const items = savedItems.map((savedItem, index) => {
      const currentService = services.find(service => service.id == savedItem.id || service.name === savedItem.name) || {};
      return {
        ...currentService,
        ...savedItem,
        price: parseFloat(savedItem.price ?? currentService.price ?? 0),
        qty: Number(savedItem.qty || 1),
        tempId: `${appointment.id}-${index}`,
      };
    }).filter(item => item.name && item.price > 0);

    if (items.length === 0) {
      automaticReceiptAppointments.current.delete(guardKey);
      alert('Appointment complete ho gaya, lekin uske services/price nahi mile. Receipt manually create karein.');
      return;
    }

    const subtotal = items.reduce((total, item) => total + item.price * item.qty, 0);
    const tax = 18;
    const taxAmt = Math.round(subtotal * tax / 100);
    const total = subtotal + taxAmt;
    const date = new Date().toISOString().split('T')[0];
    const paymentMode = 'Cash';
    const invoiceId = `appointment-${appointment.id}`;
    const invoiceNumber = `INV-APT-${appointment.id}`;
    const invoicePayload = {
      action: 'record_invoice_payment',
      appointmentId: appointment.id,
      invoiceId,
      invoiceNumber,
      customerName: appointment.customer,
      date,
      total,
      paymentMode,
    };

    const recorded = await apiAction('POST', 'payment', invoicePayload);
    if (!recorded) {
      automaticReceiptAppointments.current.delete(guardKey);
      return;
    }

    const receiptMeta = {
      customerName: appointment.customer || '',
      customerPhone: appointment.phone || '',
      customerEmail: appointment.email || '',
      customerAddress: appointment.address || '',
      discount: 0,
      tax,
      paymentMode,
      staffId: appointment.staffId || '',
    };
    const delivery = await notifyReceiptAutomation({
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      customer: { name: appointment.customer || '', email: appointment.email || '', phone: appointment.phone || '' },
      salon: { name: 'SALON MANAGEMENT SYSTEM', phone: '07674-234567', email: 'contact@salon.com', address: 'Shop No. 12, Main Market, Maihar, MP - 485771' },
      services: items.map(item => ({ name: item.name, price: Number(item.price), quantity: Number(item.qty || 1) })),
      subtotal,
      discount: 0,
      tax: taxAmt,
      final_amount: total,
      payment_method: paymentMode,
      payment_status: 'CONFIRMED',
      invoice_datetime: new Date().toISOString(),
    });
    setBillItems(items);
    setBillMeta(receiptMeta);
    setInvoices(previous => [{
      id: invoiceId, invoiceId, invoiceNumber, appointmentId: appointment.id,
      customerName: appointment.customer, date, total, paymentMode,
      emailDeliveryStatus: delivery.email_status || 'PENDING',
    }, ...previous]);
    setShowReceipt(true);
  };

  const handleUpdateAppointmentStatus = async (id, newStatus) => {
    if (!confirm(`Change status to ${newStatus}?`)) return;
    const appointment = appointments.find(item => String(item.id) === String(id));
    const updated = await apiAction('POST', 'appointments', { id, status: newStatus });
    if (updated && newStatus === 'Completed' && appointment) {
      await generateReceiptForCompletedAppointment(appointment);
    }
  };
  const handleDeleteAppointment = (id) => { if(confirm("Delete appointment record completely?")) apiAction('DELETE', 'appointments', null, id); };
  const handleMarkComplete = (id) => handleUpdateAppointmentStatus(id, 'Completed');
  const handleConfirm = (id) => handleUpdateAppointmentStatus(id, 'Confirmed');
  const handleCheckIn = (id) => handleUpdateAppointmentStatus(id, 'Checked-In');
  const handleCancel = (id) => handleUpdateAppointmentStatus(id, 'Cancelled');
  const handleShowDetails = (apt) => { setSelectedAppointment(apt); setShowAppointmentDetails(true); };

  const updateAiBookingRequest = async (id, status) => {
    try {
      const response = await fetch(`${AI_API_URL}/api/booking-requests/${id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Unable to update request');
      fetchAiBookingRequests();
    } catch (error) { alert('AI booking service is unavailable. Please try again.'); }
  };
  
  // Billing Handlers
  const handleAddToBill = (serviceId) => {
    if (!serviceId) return;
    const service = services.find(s => s.id == serviceId);
    if (service) {
        setBillItems([...billItems, { ...service, qty: 1, tempId: Date.now() }]);
        setSelectedBillingServiceId('');
    }
  };
  const handleRemoveBillItem = (tempId) => setBillItems(billItems.filter(item => item.tempId !== tempId));
  const calculateBill = () => {
    const subtotal = billItems.reduce((acc, item) => acc + (parseFloat(item.price) * item.qty), 0);
    const discountAmt = Math.round((subtotal * parseFloat(billMeta.discount || 0)) / 100);
    const taxable = subtotal - discountAmt;
    const taxAmt = Math.round((taxable * parseFloat(billMeta.tax || 0)) / 100);
    return { subtotal, discountAmt, taxAmt, grandTotal: taxable + taxAmt };
  };

  // --- RAZORPAY & INVOICE GENERATION (WITH +91 FIX AND MANDATORY PHONE) ---
  const handleGenerateInvoice = async (isOnlinePayment = false) => {
    if (billItems.length === 0) return alert("Add items first!");
    if (!billMeta.customerName) return alert("Enter Customer Name");
    
    if (!billMeta.customerPhone) return alert("Mobile Number daalna zaroori hai!");
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(billMeta.customerPhone)) return alert("Please enter a valid 10-digit mobile number.");
    
    const calc = calculateBill();
    const totalAmount = calc.grandTotal;
    const paymentMode = isOnlinePayment ? 'Online/Razorpay' : billMeta.paymentMode;

    const invoiceId = `erp-${Date.now()}`;
    const invoiceNumber = `INV-${Date.now()}`;
    const recordInvoiceAndCommission = async (paymentResponse = {}) => {
        const invoiceDateTime = new Date().toISOString();
        const payload = { action: 'record_invoice_payment', invoiceId, invoiceNumber, customerName: billMeta.customerName, date: invoiceDateTime.split('T')[0], total: totalAmount, paymentMode: paymentMode, ...paymentResponse };
        const paymentSaved = await apiAction('POST', 'payment', payload);
        if (!paymentSaved) {
            alert('Payment save failed. Receipt email was not requested.');
            return false;
        }
        
        if(billMeta.staffId) {
            const s = staff.find(st => st.id == billMeta.staffId);
            if(s) {
                const comm = Math.round((calc.subtotal * s.commissionRate) / 100);
                apiAction('POST', 'staff', { id: s.id, totalCommission: (parseFloat(s.totalCommission) || 0) + comm });
            }
        }
        
        const receiptPayload = {
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            customer: { name: billMeta.customerName, email: billMeta.customerEmail || '', phone: billMeta.customerPhone || '' },
            salon: { name: 'SALON MANAGEMENT SYSTEM', phone: '07674-234567', email: 'contact@salon.com', address: 'Shop No. 12, Main Market, Maihar, MP - 485771' },
            services: billItems.map(item => ({ name: item.name, price: Number(item.price), quantity: Number(item.qty || 1) })),
            subtotal: calc.subtotal,
            discount: calc.discountAmt,
            tax: calc.taxAmt,
            final_amount: totalAmount,
            payment_method: paymentMode,
            payment_status: 'CONFIRMED',
            invoice_datetime: invoiceDateTime,
        };
        const delivery = await notifyReceiptAutomation(receiptPayload);
        setInvoices(previous => [{ id: invoiceId, invoiceId, invoiceNumber, customerName: billMeta.customerName, date: invoiceDateTime.split('T')[0], total: totalAmount, paymentMode, emailDeliveryStatus: delivery.email_status || 'PENDING' }, ...previous]);
        setShowReceipt(true);
        return true;
    };

    if (!isOnlinePayment) return await recordInvoiceAndCommission();
    
    if (!window.Razorpay) return alert("Razorpay SDK not loaded.");
    
    const options = {
        key: RAZORPAY_KEY_ID, 
        amount: totalAmount * 100, 
        currency: "INR", 
        name: "SALON MANAGEMENT SYSTEM", 
        description: "Payment for Salon Services",
        prefill: { 
            name: billMeta.customerName, 
            email: billMeta.customerEmail || 'test@salon.com', 
            contact: '+91' + billMeta.customerPhone // +91 ADDED HERE
        },
        config: {
            display: {
                blocks: {
                    upi: {
                        name: "Pay via UPI ID",
                        instruments: [{ method: "upi" }]
                    }
                },
                sequence: ["block.upi"],
                preferences: { show_default_blocks: true }
            }
        },
        theme: { color: "#c08081" },
        handler: async function (response) { 
            await recordInvoiceAndCommission({ razorpay_payment_id: response.razorpay_payment_id }); 
        }
    };
    
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){ 
        alert("Payment failed: " + (response.error.description || response.error.reason || "Server Error")); 
    });
    rzp.open();
  };

  const handleResendReceipt = async (invoiceId) => {
    try {
      const response = await fetch(`${AI_API_URL}/api/automation/invoice-receipt/${encodeURIComponent(invoiceId)}/resend`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok && response.status !== 202) throw new Error(result.detail || 'Resend failed');
      setInvoices(previous => previous.map(invoice => invoice.invoiceId === invoiceId ? { ...invoice, emailDeliveryStatus: result.email_status || 'PENDING' } : invoice));
      alert('Receipt resend request submitted.');
    } catch (error) {
      alert(`Receipt resend failed: ${error.message}`);
    }
  };

  const handleViewReceipt = (invoiceId) => {
    window.open(`${AI_API_URL}/api/automation/invoice-receipt/${encodeURIComponent(invoiceId)}/pdf`, '_blank', 'noopener,noreferrer');
  };

  const closeReceipt = () => { setShowReceipt(false); setBillItems([]); setBillMeta({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', discount: 0, tax: 18, paymentMode: 'Cash', staffId: '' }); };

  // Calculations
  const totalSales = invoices.reduce((acc, curr) => acc + (parseFloat(curr.total)||0), 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount)||0), 0);
  const netProfit = totalSales - totalExpenses;
  const weeklyData = [12000, 15000, 8000, 19000, 22000, 18000, 25000]; 
  const upcomingBirthdays = customers.filter(c => {
    if (!c.dob) return false;
    const today = new Date(); const dob = new Date(c.dob);
    const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    const diffDays = Math.ceil((thisYearBday - today) / (1000 * 60 * 60 * 24)); 
    return diffDays >= 0 && diffDays <= 7;
  });

  const isBirthdayToday = useMemo(() => {
    const customer = customers.find(c => c.phone === billMeta.customerPhone);
    if (customer && customer.dob) {
      const today = new Date();
      const dob = new Date(customer.dob);
      return today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth();
    }
    return false;
  }, [billMeta.customerPhone, customers]);

  const generateReportData = () => {
    const filterStart = reportStartDate || null;
    const filterEnd = reportEndDate || null;
    let filteredInvoices = invoices;
    
    if (filterStart && filterEnd) {
        const startDate = new Date(filterStart); const endDate = new Date(filterEnd); endDate.setDate(endDate.getDate() + 1);
        filteredInvoices = invoices.filter(inv => { const invDate = new Date(inv.date); return invDate >= startDate && invDate < endDate; });
    } else {
        const today = new Date();
        filteredInvoices = invoices.filter(inv => {
            const invDate = new Date(inv.date); const invDateString = inv.date;
            switch (reportTimeframe) {
                case 'Daily': return invDateString === today.toISOString().split('T')[0];
                case 'Weekly': { const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7); return invDate >= sevenDaysAgo && invDate <= today; }
                case 'Monthly': return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
                case 'Yearly': return invDate.getFullYear() === today.getFullYear();
                case 'Service-wise': default: return true;
            }
        });
    }
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total||0), 0);
    const serviceSales = {};
    const allServicesMap = new Map(services.map(s => [s.id, s.name]));
    
    if (reportTimeframe === 'Service-wise' || (filterStart && filterEnd)) {
        const servicesCount = allServicesMap.size || 1;
        filteredInvoices.forEach(inv => {
            const amountPerService = parseFloat(inv.total||0) / servicesCount;
            allServicesMap.forEach((name, id) => {
                if (!serviceSales[name]) { serviceSales[name] = { total: 0, count: 0, price: services.find(s => s.id === id)?.price || 0 }; }
                serviceSales[name].total += amountPerService; serviceSales[name].count++;
            });
        });
    }
    const serviceData = Object.entries(serviceSales).filter(([name, data]) => data.total > 0).map(([name, data]) => ({ name, total: data.total, count: data.count, price: data.price }));
    return { filteredInvoices, totalRevenue, serviceData };
  };

  // --- RENDERERS ---
  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#c08081]"><div className="flex justify-between"><div><p className="text-gray-500 text-sm font-medium">Revenue</p><h3 className="text-2xl font-bold text-gray-800">₹{totalSales.toLocaleString()}</h3></div><div className="bg-rose-100 p-3 rounded-full text-[#c08081]"><DollarSign size={24}/></div></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-green-500"><div className="flex justify-between"><div><p className="text-gray-500 text-sm font-medium">Net Profit</p><h3 className="text-2xl font-bold text-green-600">₹{netProfit.toLocaleString()}</h3></div><div className="bg-green-100 p-3 rounded-full text-green-600"><TrendingUp size={24}/></div></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500"><div className="flex justify-between"><div><p className="text-gray-500 text-sm font-medium">Customers</p><h3 className="text-2xl font-bold text-gray-800">{customers.length}</h3></div><div className="bg-blue-100 p-3 rounded-full text-blue-600"><Users size={24}/></div></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500"><div className="flex justify-between"><div><p className="text-gray-500 text-sm font-medium">Appointments</p><h3 className="text-2xl font-bold text-gray-800">{appointments.filter(a => a.status!=='Completed' && a.status!=='Cancelled').length}</h3></div><div className="bg-purple-100 p-3 rounded-full text-purple-600"><Calendar size={24}/></div></div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-4">Weekly Sales Trends</h3><BarChart data={weeklyData} /></div>
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm border border-purple-200">
               <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2"><Gift size={20} /> Upcoming Birthdays</h3>
               <div className="space-y-3">
                  {upcomingBirthdays.length > 0 ? upcomingBirthdays.map(c => (<div key={c.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center"><div><p className="font-bold text-gray-800">{c.name}</p><p className="text-xs text-gray-500">{new Date(c.dob).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</p></div><span className="text-lg">🎂</span></div>)) : <p className="text-sm text-gray-500">No birthdays in next 7 days.</p>}
               </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-gray-700 mb-4">Quick Actions</h3>
               <div className="space-y-3">
                  <button onClick={() => setActiveTab('billing')} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-rose-50 text-gray-800"><div className="bg-[#c08081] p-2 rounded text-white"><Receipt size={18} /></div><span className="font-medium">New Invoice</span></button>
                  <button onClick={() => setActiveTab('appointments')} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 text-gray-800"><div className="bg-blue-500 p-2 rounded text-white"><Calendar size={18} /></div><span className="font-medium">Book Appointment</span></button>
               </div>
            </div>
        </div>
      </div>
    </div>
  );

  const renderAppointmentsUI = () => {
    const estimatedCost = aptForm.addedServices.reduce((sum, s) => sum + parseFloat(s.price||0), 0);
    const upcomingAppointments = appointments.filter(apt => apt.status !== 'Completed' && apt.status !== 'Cancelled');
    const getStatusClasses = (status) => {
        if(status === 'Confirmed') return 'bg-green-100 text-green-700 border-green-200';
        if(status === 'Checked-In') return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    };
    
    const getServiceNames = (servicesJsonStr) => {
       const parsedArr = safeJSONParse(servicesJsonStr);
       return parsedArr.length > 0 ? parsedArr.map(s => s?.name || 'Unknown').join(', ') : 'No specific services';
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-gray-800">
         <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
           <div className="border-b border-gray-100 pb-4 mb-6"><h3 className="font-bold text-xl text-[#c08081] flex items-center gap-2"><Calendar /> Book Appointment</h3></div>
           <form onSubmit={handleBookAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                  <h4 className="font-bold text-gray-700 flex items-center gap-2"><Users size={18}/> Customer Details</h4>
                  <div className="relative"><Users size={16} className="absolute left-3 top-3 text-gray-400" /><input required placeholder="Full Name" className="w-full pl-10 p-2 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={aptForm.customer} onChange={e => setAptForm({...aptForm, customer: e.target.value})}/></div>
                  <div className="relative"><Phone size={16} className="absolute left-3 top-3 text-gray-400" /><input required type="tel" placeholder="Phone (10 digits)" className="w-full pl-10 p-2 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={aptForm.phone} onChange={e => setAptForm({...aptForm, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10)})} maxLength="10" /></div>
                  <div className="relative"><Mail size={16} className="absolute left-3 top-3 text-gray-400" /><input type="email" placeholder="Email (optional)" className="w-full pl-10 p-2 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={aptForm.email} onChange={e => setAptForm({...aptForm, email: e.target.value})} /></div>
                  <div className="relative"><MapPin size={16} className="absolute left-3 top-3 text-gray-400" /><textarea placeholder="Address" className="w-full pl-10 p-2 border border-gray-300 rounded h-20 resize-none bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={aptForm.address} onChange={e => setAptForm({...aptForm, address: e.target.value})}/></div>
                  <div><label className="text-xs font-bold text-gray-500 mb-1 block">Booking Source</label><select className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800" value={aptForm.source} onChange={e => setAptForm({...aptForm, source: e.target.value})}><option>Walk-in</option><option>Instagram</option><option>Google</option><option>Friend Referral</option></select></div>
              </div>
              <div className="space-y-5">
                  <h4 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> Details</h4>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex gap-2 mb-3">
                          <select className="flex-grow p-2 border border-gray-300 rounded bg-white text-gray-800" value={aptForm.selectedServiceId} onChange={e => setAptForm({...aptForm, selectedServiceId: e.target.value})}>
                             <option value="">-- Choose Service --</option>
                             {services.map(s => <option key={s.id} value={s.id}>{s.name} - ₹{s.price}</option>)}
                          </select>
                          <button type="button" onClick={() => { const s = services.find(sr => sr.id == aptForm.selectedServiceId); if(s && !aptForm.addedServices.find(as=>as.id===s.id)) setAptForm({...aptForm, addedServices: [...aptForm.addedServices, s]}) }} className="bg-[#c08081] text-white px-3 rounded hover:bg-[#a86b6c] transition-colors"><Plus size={18} /></button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
                          {aptForm.addedServices.map((s, i) => (<div key={i} className="bg-white border border-gray-200 shadow-sm px-3 py-1 rounded-full text-sm flex items-center gap-2"><span className="text-gray-700 font-medium">{s.name}</span><button type="button" onClick={() => setAptForm({...aptForm, addedServices: aptForm.addedServices.filter(as => as.id !== s.id)})} className="text-red-400 hover:text-red-600"><X size={14}/></button></div>))}
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2"><span className="text-sm font-bold text-gray-600">Est. Cost:</span><span className="text-lg font-bold text-[#c08081]">₹{estimatedCost}</span></div>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500 mb-1 block">Staff</label><select className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800" value={aptForm.staffId} onChange={e => setAptForm({...aptForm, staffId: e.target.value})}><option value="">-- Any --</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block">Date</label><input type="date" required className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800" value={aptForm.date} onChange={e => setAptForm({...aptForm, date: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block">Time</label><input type="time" required className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800" value={aptForm.time} onChange={e => setAptForm({...aptForm, time: e.target.value})} /></div>
                  </div>
                  <button className="w-full bg-[#c08081] text-white py-3 rounded-lg hover:bg-[#a86b6c] font-bold mt-4 shadow-sm transition-colors">Confirm Appointment</button>
              </div>
           </form>
         </div>
         <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm h-fit border border-gray-100">
           <h3 className="font-bold text-lg mb-4 text-gray-700 flex items-center gap-2"><Calendar className="text-[#c08081]" /> Upcoming ({upcomingAppointments.length})</h3>
           <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {upcomingAppointments.map(apt => (
                <div key={apt.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md bg-gray-50 transition-shadow">
                   <div className="flex justify-between items-start mb-2">
                       <div className="bg-[#c08081] text-white px-2 py-1 rounded text-xs font-bold">{apt.time}</div>
                       <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusClasses(apt.status)}`}>{apt.status}</span>
                   </div>
                   <h4 className="font-bold text-gray-800 flex items-center gap-2 text-lg mt-1">{apt.customer}</h4>
                   <p className="text-xs text-gray-500 font-medium">{apt.date}</p>
                   <p className="text-xs text-gray-600 mt-2 bg-white border border-gray-200 p-2 rounded-md truncate" title={getServiceNames(apt.services_json)}>{getServiceNames(apt.services_json)}</p>
                   <div className="mt-3 flex gap-2 flex-wrap">
                        <button onClick={() => handleShowDetails(apt)} className="flex-1 bg-gray-200 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-300 font-medium">View Info</button>
                        {apt.status === 'Pending' && <button onClick={() => handleConfirm(apt.id)} className="flex-1 bg-blue-500 text-white text-xs py-1.5 rounded hover:bg-blue-600 font-medium">Confirm</button>}
                        {(apt.status === 'Confirmed' || apt.status === 'Pending') && <button onClick={() => handleCheckIn(apt.id)} className="flex-1 bg-yellow-500 text-white text-xs py-1.5 rounded hover:bg-yellow-600 font-medium">Check-In</button>}
                        {apt.status === 'Checked-In' && <button onClick={() => handleMarkComplete(apt.id)} className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700 font-medium">Complete</button>}
                        <button onClick={() => handleCancel(apt.id)} className="flex-1 bg-gray-400 text-white text-xs py-1.5 rounded hover:bg-gray-500 font-medium">Cancel</button>
                   </div>
                </div>
              ))}
              {upcomingAppointments.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No pending appointments.</p>}
           </div>
         </div>
      </div>
    );
  };

  const renderHistoryUI = () => {
    const historyAppointments = appointments.filter(apt => apt.status === 'Completed' || apt.status === 'Cancelled').sort((a, b) => new Date(b.date) - new Date(a.date));
    const getHistoryStatusClasses = (status) => status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200';
    
    const getServiceNames = (servicesJsonStr) => {
       const parsedArr = safeJSONParse(servicesJsonStr);
       return parsedArr.length > 0 ? parsedArr.map(s => s?.name || 'Unknown').join(', ') : 'No specific services';
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-gray-800">
            <h3 className="font-bold text-xl text-gray-700 mb-6 flex items-center gap-2"><History className="text-[#c08081]" /> Appointment History</h3>
            <div className="space-y-4">
                {historyAppointments.length > 0 ? historyAppointments.map(apt => (
                    <div key={apt.id} className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                        <div>
                            <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">{apt.customer} <span className="text-sm font-medium text-gray-500">({apt.phone})</span></h4>
                            <p className="text-sm text-gray-600 font-medium mt-0.5"><Calendar size={12} className="inline mr-1"/>{apt.date} at {apt.time}</p>
                            <p className="text-xs text-gray-500 mt-2 bg-gray-50 inline-block px-2 py-1 rounded border border-gray-100">Services: {getServiceNames(apt.services_json)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${getHistoryStatusClasses(apt.status)}`}>{apt.status}</span>
                            <button onClick={() => handleDeleteAppointment(apt.id)} className="text-red-400 hover:text-white hover:bg-red-500 p-2 rounded-full transition-colors" title="Delete Record"><Trash2 size={18} /></button>
                        </div>
                    </div>
                )) : <p className="text-sm text-gray-500 text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">No past appointments recorded.</p>}
            </div>
        </div>
    );
  };

  const renderBillingUI = () => {
    const calc = calculateBill();
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-100px)] text-gray-800">
        <div className="lg:col-span-5 flex flex-col gap-4">
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-700 flex items-center gap-2"><Users size={18}/> Customer Details</h4>
                  {isBirthdayToday && <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200 flex items-center gap-1"><Gift size={12}/> B-Day Discount!</div>}
              </div>
              <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Full Name" className="p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={billMeta.customerName} onChange={e => setBillMeta({...billMeta, customerName: e.target.value})} />
                    
                    {/* FIXED: +91 Phone Input UI */}
                    <div className="flex border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#c08081]">
                        <span className="p-2.5 bg-gray-50 border-r border-gray-300 text-gray-600 font-bold rounded-l-lg">+91</span>
                        <input placeholder="Phone (10 digits)" type="tel" maxLength="10" className="w-full p-2.5 bg-transparent text-gray-800 outline-none rounded-r-lg" value={billMeta.customerPhone} onChange={e => setBillMeta({...billMeta, customerPhone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10)})} />
                    </div>
                  </div>
                  <input placeholder="Email" type="email" className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={billMeta.customerEmail} onChange={e => setBillMeta({...billMeta, customerEmail: e.target.value})} />
                  <textarea placeholder="Address" className="w-full p-2.5 border border-gray-300 rounded-lg h-20 resize-none bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={billMeta.customerAddress} onChange={e => setBillMeta({...billMeta, customerAddress: e.target.value})} />
              </div>
           </div>
           <div className="bg-white p-5 rounded-xl shadow-sm flex-grow border border-gray-100 flex flex-col">
              <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Scissors size={18}/> Add Services</h4>
              <div className="flex gap-2 mb-4">
                 <select className="flex-grow p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={selectedBillingServiceId} onChange={e => setSelectedBillingServiceId(e.target.value)}>
                    <option value="">Select Service...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} - ₹{s.price}</option>)}
                 </select>
                 <button onClick={() => selectedBillingServiceId && handleAddToBill(selectedBillingServiceId)} className="bg-[#c08081] text-white px-5 rounded-lg hover:bg-[#a86b6c] transition-colors"><Plus /></button>
              </div>
              <div className="flex-grow overflow-y-auto border border-gray-200 rounded-lg">
                 <table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-600 sticky top-0"><tr><th className="p-3 font-bold">Item</th><th className="p-3 text-center font-bold">Price</th><th className="p-3 text-center font-bold">Action</th></tr></thead>
                 <tbody className="divide-y divide-gray-100">{billItems.map(item => (<tr key={item.tempId} className="hover:bg-gray-50"><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-center text-gray-600">₹{item.price}</td><td className="p-3 text-center"><button onClick={() => handleRemoveBillItem(item.tempId)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button></td></tr>))}
                 {billItems.length === 0 && <tr><td colSpan="3" className="p-4 text-center text-gray-400">No items added to bill.</td></tr>}
                 </tbody></table>
              </div>
           </div>
        </div>
        <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm h-full flex flex-col border border-gray-100">
                <h4 className="font-bold text-gray-700 text-lg mb-4 border-b border-gray-100 pb-3">Invoice & Payment Summary</h4>
                <div className="grid grid-cols-2 gap-6 mb-6">
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Assign Staff (For Commission)</label>
                    <select className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={billMeta.staffId} onChange={e => setBillMeta({...billMeta, staffId: e.target.value})}>
                        <option value="">-- No Staff Assigned --</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Payment Mode</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        {['Cash', 'UPI', 'Card', 'Online'].map(mode => (
                            <button key={mode} onClick={() => setBillMeta({...billMeta, paymentMode: mode})} className={`flex-1 text-sm py-2 rounded-md transition-all font-medium ${billMeta.paymentMode === mode ? 'bg-white shadow text-[#c08081]' : 'text-gray-500 hover:bg-gray-200'}`}>{mode}</button>
                        ))}
                    </div>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                  <div><label className="text-xs font-bold text-gray-500 block mb-1.5">Discount (%)</label><input type="number" min="0" max="100" value={billMeta.discount} onChange={e => setBillMeta({...billMeta, discount: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none"/></div>
                  <div><label className="text-xs font-bold text-gray-500 block mb-1.5">Tax (%)</label><input type="number" min="0" value={billMeta.tax} onChange={e => setBillMeta({...billMeta, tax: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none"/></div>
              </div>
              
              <div className="mt-auto bg-gray-50 p-6 rounded-xl space-y-3 border border-gray-200">
                 <div className="flex justify-between text-gray-600 font-medium"><span>Subtotal Amount</span><span>₹{calc.subtotal}</span></div>
                 <div className="flex justify-between text-rose-500 text-sm font-medium"><span>Discount Applied</span><span>- ₹{calc.discountAmt}</span></div>
                 <div className="flex justify-between text-gray-600 text-sm font-medium"><span>Tax Added</span><span>+ ₹{calc.taxAmt}</span></div>
                 <div className="flex justify-between text-3xl font-extrabold text-gray-900 border-t border-gray-300 pt-4 mt-4"><span>Grand Total</span><span>₹{calc.grandTotal}</span></div>
                 
                 <button onClick={() => handleGenerateInvoice(billMeta.paymentMode === 'Online')} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 mt-6 text-white shadow-md transition-all transform hover:-translate-y-0.5 ${billMeta.paymentMode === 'Online' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'}`}>
                    {billMeta.paymentMode === 'Online' ? <CreditCard size={20}/> : <CheckCircle size={20}/>} 
                    {billMeta.paymentMode === 'Online' ? ' Pay Securely & Generate' : ' Record Payment & Print Invoice'}
                 </button>
              </div>
            </div>
        </div>
      </div>
    );
  };

  const renderCustomersUI = () => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 text-gray-800">
       <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-700">Customer Database</h3><button onClick={() => {handleCancelCustomerForm(); setShowCustomerForm(!showCustomerForm);}} className="bg-[#c08081] text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-[#a86b6c] transition-colors"><Plus size={18} /> Add New</button></div>
       {showCustomerForm && (
         <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4">{editingCustomer ? 'Edit Customer Info' : 'Register New Customer'}</h4>
            <form onSubmit={handleSaveCustomer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">Full Name</label><input required className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} /></div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">Phone Number</label><input required type="tel" maxLength="10" className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10)})} /></div>
               <div><label className="text-xs font-bold text-gray-500 mb-1 block">Date of Birth</label><input type="date" className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={custForm.dob || ''} onChange={e => setCustForm({...custForm, dob: e.target.value})} /></div>
               
               <div className="flex items-center gap-3 border border-gray-300 p-2.5 rounded-lg bg-white h-[46px]">
                   <input type="checkbox" id="vipCheck" checked={custForm.isVip == 1} onChange={e => setCustForm({...custForm, isVip: e.target.checked ? 1 : 0})} className="w-4 h-4 accent-[#c08081]" />
                   <label htmlFor="vipCheck" className="text-sm font-bold text-[#c08081] flex items-center gap-1 cursor-pointer"><Star size={16} /> Mark as VIP Customer</label>
               </div>
               <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 mb-1 block">VIP Preferences / Notes</label><input placeholder="Likes coffee, specific therapist, etc." className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" value={custForm.vipNotes} onChange={e => setCustForm({...custForm, vipNotes: e.target.value})} /></div>
               
               <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                   <button type="button" onClick={handleCancelCustomerForm} className="px-5 py-2.5 text-gray-600 font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                   <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"><Save size={18}/> {editingCustomer ? 'Update' : 'Save'}</button>
               </div>
            </form>
         </div>
       )}
       <div className="overflow-x-auto">
         <table className="w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm"><tr><th className="p-4 font-bold">Name</th><th className="p-4 font-bold">Phone</th><th className="p-4 font-bold">Total Spent</th><th className="p-4 font-bold">DOB</th><th className="p-4 font-bold">Status</th><th className="p-4 text-center font-bold">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
             {customers.map(c => (
                 <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.isVip == 1 ? 'bg-yellow-50/50' : ''}`}>
                     <td className="p-4 font-medium text-gray-800">{c.name}</td>
                     <td className="p-4 text-gray-600">{c.phone}</td>
                     <td className="p-4 font-bold text-[#c08081]">₹{parseFloat(c.totalSpent||0).toLocaleString()}</td>
                     <td className="p-4 text-sm text-gray-600">{c.dob || '-'}</td>
                     <td className="p-4">{c.isVip == 1 && <span className="flex items-center gap-1 text-xs font-bold text-yellow-700 border border-yellow-300 px-2.5 py-1 rounded-full w-fit bg-yellow-100 shadow-sm"><Star size={12} fill="currentColor" /> VIP</span>}</td>
                     <td className="p-4 flex gap-3 justify-center">
                         <button onClick={() => handleEditCustomer(c)} className="text-blue-500 hover:bg-blue-100 p-2 rounded transition-colors" title="Edit"><Pencil size={18}/></button>
                         <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:bg-red-100 p-2 rounded transition-colors" title="Delete"><Trash2 size={18}/></button>
                     </td>
                 </tr>
             ))}
             {customers.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-medium">No customers found.</td></tr>}
          </tbody>
       </table>
       </div>
    </div>
  );

  const renderSpecialCustomersUI = () => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 text-gray-800">
       <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-white flex items-center gap-2"><Star className="text-yellow-500" fill="currentColor" size={24}/><h3 className="font-bold text-gray-800 text-xl">VIP Customers Board</h3></div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50/50">
          {customers.filter(c => c.isVip == 1).map(c => (
              <div key={c.id} className="border border-yellow-200 rounded-xl p-5 bg-white shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                  <div className="absolute top-0 right-0 bg-yellow-400 text-white p-2 rounded-bl-xl"><Star size={16} fill="currentColor" /></div>
                  <h4 className="font-bold text-xl text-gray-800 mb-1 pr-8">{c.name}</h4>
                  <p className="text-sm text-gray-600 mb-3 flex items-center gap-1.5"><Phone size={14}/> {c.phone}</p>
                  <div className="text-sm bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 text-gray-700 italic mb-4 min-h-[60px]">"{c.vipNotes || 'No preferences recorded.'}"</div>
                  <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3">
                      <span className="font-bold text-[#c08081] text-lg">₹{parseFloat(c.totalSpent||0).toLocaleString()} <span className="text-xs text-gray-400 font-normal">Spent</span></span>
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-xs font-bold border border-gray-200">{c.visits} Visits</span>
                  </div>
              </div>
          ))}
          {customers.filter(c => c.isVip == 1).length === 0 && <div className="col-span-full p-10 text-center text-gray-500 bg-white border border-dashed rounded-xl">No VIP customers yet. Edit a customer to mark them as VIP.</div>}
       </div>
    </div>
  );

  const renderStaffUI = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-gray-800">
       <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="p-4 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-700">Staff Performance</h3></div>
          <div className="overflow-x-auto">
              <table className="w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm"><tr><th className="p-4 font-bold">Name</th><th className="p-4 font-bold">Role</th><th className="p-4 font-bold text-center">Comm %</th><th className="p-4 font-bold text-right">Earned</th><th className="p-4 font-bold text-center">Actions</th></tr></thead>
                 <tbody className="divide-y divide-gray-100">
                    {staff.map(s => (
                       <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold text-gray-800">{s.name}</td>
                          <td className="p-4 text-sm text-gray-600"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">{s.role}</span></td>
                          <td className="p-4 font-medium text-center">{s.commissionRate}%</td>
                          <td className="p-4 font-extrabold text-green-600 text-right">₹{parseFloat(s.totalCommission||0).toLocaleString()}</td>
                          <td className="p-4 flex gap-2 justify-center">
                              <button onClick={() => {setEditingStaff(s.id); setStaffForm({name:s.name, role:s.role, commissionRate:s.commissionRate})}} className="text-blue-500 hover:bg-blue-100 p-2 rounded transition-colors" title="Edit"><Pencil size={18}/></button>
                              <button onClick={() => handleDeleteStaff(s.id)} className="text-red-500 hover:bg-red-100 p-2 rounded transition-colors" title="Delete"><Trash2 size={18}/></button>
                          </td>
                       </tr>
                    ))}
                    {staff.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">No staff members found.</td></tr>}
                 </tbody>
              </table>
          </div>
       </div>
       <div className="bg-white p-6 rounded-xl shadow-sm h-fit border border-gray-100">
          <h3 className="font-bold text-gray-700 text-lg mb-5 flex items-center gap-2"><Briefcase className="text-[#c08081]"/> {editingStaff ? 'Edit Staff Member' : 'Add New Staff'}</h3>
          <form onSubmit={handleSaveStaff} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label><input required value={staffForm.name} onChange={e => setStaffForm({...staffForm, name:e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="e.g. Anil Kumar"/></div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Designation / Role</label>
                  <select required value={staffForm.role} onChange={e => setStaffForm({...staffForm, role:e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none">
                      <option value="">Select Role...</option>
                      <option>Manager</option>
                      <option>Senior Stylist</option>
                      <option>Beautician</option>
                      <option>Makeup Artist</option>
                      <option>Helper</option>
                  </select>
              </div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Commission Percentage (on services)</label><input type="number" min="0" max="100" required value={staffForm.commissionRate} onChange={e => setStaffForm({...staffForm, commissionRate:Number(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none"/></div>
              <div className="flex gap-3 pt-3 border-t border-gray-100 mt-2">
                  <button type="submit" className="flex-1 bg-[#c08081] text-white py-2.5 rounded-lg font-bold hover:bg-[#a86b6c] transition-colors shadow-sm flex items-center justify-center gap-2"><Save size={18}/> {editingStaff ? 'Update' : 'Save Staff'}</button>
                  {editingStaff && <button type="button" onClick={() => {setEditingStaff(null); setStaffForm({name:'', role:'', commissionRate:0})}} className="px-5 border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50">Cancel</button>}
              </div>
          </form>
       </div>
    </div>
  );

  const renderServicesUI = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-gray-800">
       <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Service Menu</h3><span className="text-xs font-bold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">{services.length} Total</span></div>
          <div className="overflow-x-auto">
              <table className="w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm"><tr><th className="p-4 font-bold">Service Name</th><th className="p-4 font-bold">Category</th><th className="p-4 font-bold">Duration</th><th className="p-4 font-bold text-right">Price</th><th className="p-4 font-bold text-center">Actions</th></tr></thead>
                 <tbody className="divide-y divide-gray-100">
                    {services.map(s => (
                       <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold text-gray-800">{s.name}</td>
                          <td className="p-4"><span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">{s.category}</span></td>
                          <td className="p-4 text-sm text-gray-600 font-medium flex items-center gap-1 mt-0.5"><Clock size={14}/>{s.duration}</td>
                          <td className="p-4 font-extrabold text-[#c08081] text-right">₹{s.price}</td>
                          <td className="p-4 flex gap-2 justify-center">
                              <button onClick={() => {setEditingService(s.id); setServiceForm({name:s.name, category:s.category, price:s.price, duration:s.duration})}} className="text-blue-500 hover:bg-blue-100 p-2 rounded transition-colors"><Pencil size={18}/></button>
                              <button onClick={() => handleDeleteService(s.id)} className="text-red-500 hover:bg-red-100 p-2 rounded transition-colors"><Trash2 size={18}/></button>
                          </td>
                       </tr>
                    ))}
                    {services.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">No services added yet.</td></tr>}
                 </tbody>
              </table>
          </div>
       </div>
       <div className="bg-white p-6 rounded-xl shadow-sm h-fit border border-gray-100">
          <h3 className="font-bold text-gray-700 text-lg mb-5 flex items-center gap-2"><Scissors className="text-[#c08081]"/> {editingService ? 'Edit Service' : 'Add New Service'}</h3>
          <form onSubmit={handleSaveService} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Service Name</label><input required value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name:e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="e.g. Advanced Hair Spa"/></div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                  <select required value={serviceForm.category} onChange={e => setServiceForm({...serviceForm, category:e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none">
                      <option>Hair</option><option>Skin</option><option>Nails</option><option>Spa</option><option>Bridal</option><option>Makeup</option>
                  </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Price (₹)</label><input required type="number" min="0" value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price:e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="0"/></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Duration</label><input value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration:e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="e.g. 45 mins"/></div>
              </div>
              <div className="flex gap-3 pt-3 border-t border-gray-100 mt-2">
                  <button type="submit" className="flex-1 bg-[#c08081] text-white py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-[#a86b6c] transition-colors shadow-sm"><Save size={18}/> {editingService ? 'Update' : 'Add Service'}</button>
                  {editingService && <button type="button" onClick={() => {setEditingService(null); setServiceForm({name:'', category:'Hair', price:'', duration:''})}} className="px-5 border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50">Cancel</button>}
              </div>
          </form>
       </div>
    </div>
  );

  const renderExpensesUI = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-gray-800">
       <div className="bg-white p-6 rounded-xl shadow-sm h-fit border border-gray-100">
          <h3 className="font-bold text-gray-700 text-lg mb-5 flex items-center gap-2"><Wallet size={20} className="text-red-500"/> {editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
          <form onSubmit={handleSaveExpense} className="space-y-4">
             <div><label className="block text-xs font-bold text-gray-500 mb-1">Expense Title</label><input required placeholder="e.g. Electricity Bill" className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-red-400 outline-none" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} /></div>
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                <select className="w-full p-2.5 border border-gray-300 rounded-lg mb-2 bg-white text-gray-800 focus:ring-2 focus:ring-red-400 outline-none" value={expenseForm.category || 'Utilities'} onChange={e => { setExpenseForm({...expenseForm, category: e.target.value}); setIsCustomCategory(e.target.value === 'Other'); }}>
                    {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="Other">+ Add Custom Category</option>
                </select>
                {isCustomCategory && <input id="custom_category" placeholder="Enter Custom Category Name" className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 focus:ring-2 focus:ring-red-400 outline-none" required />}
             </div>
             <div><label className="block text-xs font-bold text-gray-500 mb-1">Amount (₹)</label><input type="number" min="1" required placeholder="0" className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-red-400 outline-none" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} /></div>
             <div className="flex gap-3 pt-3 border-t border-gray-100 mt-2">
                 <button className="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition-colors shadow-sm flex items-center justify-center gap-2"><Plus size={18}/> {editingExpense ? 'Update Expense' : 'Record Expense'}</button>
                 {editingExpense && <button type="button" onClick={handleCancelExpenseForm} className="px-5 border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50">Cancel</button>}
             </div>
          </form>
       </div>
       <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Recent Expenses</h3><span className="text-red-600 font-extrabold bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 text-sm tracking-wide">Total: ₹{expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount)||0), 0).toLocaleString()}</span></div>
          <div className="overflow-x-auto">
              <table className="w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm"><tr><th className="p-4 font-bold">Date</th><th className="p-4 font-bold">Title</th><th className="p-4 font-bold">Category</th><th className="p-4 font-bold text-right">Amount</th><th className="p-4 font-bold text-center">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                  {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-gray-500 text-sm font-medium"><Calendar size={14} className="inline mr-1 mb-0.5"/>{e.date}</td>
                          <td className="p-4 font-bold text-gray-800">{e.title}</td>
                          <td className="p-4"><span className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md text-xs font-bold text-gray-600">{e.category}</span></td>
                          <td className="p-4 text-right font-extrabold text-red-500">-₹{parseFloat(e.amount).toLocaleString()}</td>
                          <td className="p-4 flex gap-2 justify-center">
                              <button onClick={() => handleEditExpense(e)} className="text-blue-500 hover:bg-blue-100 p-2 rounded transition-colors" title="Edit"><Pencil size={18}/></button>
                              <button onClick={() => handleDeleteExpense(e.id)} className="text-red-500 hover:bg-red-100 p-2 rounded transition-colors" title="Delete"><Trash2 size={18}/></button>
                          </td>
                      </tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">No expenses recorded yet.</td></tr>}
              </tbody></table>
          </div>
       </div>
    </div>
  );

  const renderInventoryUI = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-gray-800">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Current Stock</h3><span className="text-xs font-bold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">{inventory.length} Items</span></div>
            <div className="overflow-x-auto">
                <table className="w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm"><tr><th className="p-4 font-bold">Item Name</th><th className="p-4 font-bold text-right">Price</th><th className="p-4 font-bold text-center">Stock Qty</th><th className="p-4 font-bold">Status</th><th className="p-4 font-bold text-center">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                    {inventory.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-gray-800">{item.name}</td>
                            <td className="p-4 text-gray-600 font-medium text-right">₹{item.price}</td>
                            <td className="p-4">
                                <div className="flex items-center justify-center gap-3">
                                    <button onClick={() => handleUpdateStock(item.id, item.qty - 1)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-colors"><Minus size={14}/></button>
                                    <span className="font-extrabold w-8 text-center text-lg">{item.qty}</span>
                                    <button onClick={() => handleUpdateStock(item.id, item.qty + 1)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-colors"><Plus size={14}/></button>
                                </div>
                            </td>
                            <td className="p-4">
                                {item.qty === 0 ? <span className="bg-red-100 text-red-700 border border-red-200 text-xs px-2.5 py-1 rounded-full font-bold">Out of Stock</span> :
                                 item.qty < 5 ? <span className="bg-yellow-100 text-yellow-700 border border-yellow-300 text-xs px-2.5 py-1 rounded-full font-bold">Low Stock</span> : 
                                 <span className="bg-green-100 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded-full font-bold">In Stock</span>}
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => handleDeleteInventory(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    ))}
                    {inventory.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">Inventory is empty. Add new products.</td></tr>}
                </tbody></table>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm h-fit border border-gray-100">
            <h3 className="font-bold text-gray-700 text-lg mb-5 flex items-center gap-2"><Package size={20} className="text-[#c08081]"/> Add New Product</h3>
            <form onSubmit={handleAddInventory} className="space-y-4">
                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Product Name</label><input name="name" required className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="e.g. Loreal Serum"/></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block">Price (₹)</label><input name="price" type="number" min="0" required className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="0"/></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block">Initial Qty</label><input name="qty" type="number" min="1" required className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#c08081] outline-none" placeholder="1" defaultValue="1"/></div>
                </div>
                <div className="pt-3 border-t border-gray-100 mt-2">
                    <button className="w-full bg-[#c08081] text-white py-3 rounded-lg font-bold hover:bg-[#a86b6c] transition-colors shadow-sm flex justify-center items-center gap-2"><Plus size={18}/> Add to Inventory</button>
                </div>
            </form>
        </div>
    </div>
  );

  const renderReportsUI = () => {
    const { filteredInvoices, totalRevenue, serviceData } = generateReportData();
    const exportToCSV = (data, filename) => {
        if (data.length === 0) return alert("No data to export!");
        const header = ['Date', 'Customer Name', 'Total Amount', 'Payment Mode'];
        const csvRows = [header.join(','), ...data.map(inv => [inv.date, inv.customerName.replace(/,/g, ''), inv.total, inv.paymentMode].join(','))];
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute('href', url); link.setAttribute('download', filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
    };
    const handleDateRangeChange = (timeframe) => { setReportTimeframe(timeframe); setReportStartDate(''); setReportEndDate(''); };
    const getDateLabel = () => {
        if (reportStartDate && reportEndDate) return `Custom Range: ${reportStartDate} to ${reportEndDate}`;
        switch (reportTimeframe) {
            case 'Daily': return `Today: ${new Date().toISOString().split('T')[0]}`;
            case 'Weekly': return `This Week`;
            case 'Monthly': return `This Month`;
            case 'Yearly': return `This Year (${new Date().getFullYear()})`;
            case 'Service-wise': return `All Time Service Breakdown`;
            default: return 'Filtered Sales Data';
        }
    };

    return (
        <div className="space-y-6 text-gray-800">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-2xl text-[#c08081] mb-5 flex items-center gap-2"><TrendingUp size={28}/> Sales & Revenue Reports</h3>
                <div className="mb-6 space-y-5">
                    <div className="flex flex-wrap gap-3">
                        {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Service-wise'].map(timeframe => (
                            <button key={timeframe} onClick={() => handleDateRangeChange(timeframe)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${reportTimeframe === timeframe && !reportStartDate ? 'bg-[#c08081] text-white shadow-md transform -translate-y-0.5' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}>
                                {timeframe} Sales
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                        <div className="flex-1 min-w-[150px]"><label className="block text-xs font-bold text-gray-600 mb-1.5">Custom Start Date</label><input type="date" value={reportStartDate} onChange={e => { setReportStartDate(e.target.value); setReportTimeframe('Custom'); }} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#c08081] outline-none" /></div>
                        <div className="flex-1 min-w-[150px]"><label className="block text-xs font-bold text-gray-600 mb-1.5">Custom End Date</label><input type="date" value={reportEndDate} onChange={e => { setReportEndDate(e.target.value); setReportTimeframe('Custom'); }} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#c08081] outline-none" /></div>
                        <button onClick={() => exportToCSV(filteredInvoices, `${reportTimeframe}_Sales_Report.csv`)} className="bg-gray-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-black transition-colors shadow-sm h-[46px]"><Printer size={16}/> Export CSV</button>
                    </div>
                </div>
                <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-bold text-gray-800 text-lg mb-4">{getDateLabel()}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100"><p className="text-sm font-bold text-blue-800 mb-1">Total Revenue</p><p className="text-3xl font-extrabold text-blue-900">₹{totalRevenue.toLocaleString()}</p></div>
                        <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100"><p className="text-sm font-bold text-purple-800 mb-1">Total Invoices</p><p className="text-3xl font-extrabold text-purple-900">{filteredInvoices.length}</p></div>
                        <div className="bg-green-50/50 p-5 rounded-xl border border-green-100"><p className="text-sm font-bold text-green-800 mb-1">Avg Invoice Value</p><p className="text-3xl font-extrabold text-green-900">₹{(totalRevenue / (filteredInvoices.length || 1)).toFixed(0)}</p></div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <h4 className="font-bold text-gray-800 text-xl mb-4">Detailed Breakdown</h4>
                {receiptStatuses.length > 0 && <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-4"><h5 className="mb-3 font-bold text-green-900">Saved Receipts</h5><div className="flex flex-wrap gap-3">{receiptStatuses.map(receipt => <span key={receipt.invoice_id} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"><span className="font-medium">{receipt.invoice_number}</span><span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold">{receipt.status}</span><button onClick={() => handleViewReceipt(receipt.invoice_id)} className="font-bold text-green-700 hover:underline">View Receipt</button></span>)}</div></div>}
                {filteredInvoices.some(invoice => invoice.invoiceId) && <div className="mb-4 rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm"><span className="font-bold text-purple-900">Receipt email delivery:</span> {filteredInvoices.filter(invoice => invoice.invoiceId).map(invoice => <span key={invoice.invoiceId} className="ml-3 inline-flex items-center gap-2"><span className="font-medium">{invoice.invoiceNumber || invoice.invoiceId}</span><span className="rounded bg-white px-2 py-1 text-xs font-bold">{invoice.emailDeliveryStatus || 'PENDING'}</span><button onClick={() => handleViewReceipt(invoice.invoiceId)} className="font-bold text-green-700 hover:underline">View Receipt</button>{invoice.emailDeliveryStatus !== 'SENT' && <button onClick={() => handleResendReceipt(invoice.invoiceId)} className="font-bold text-blue-600 hover:underline">Resend</button>}</span>)}</div>}
                {(reportTimeframe === 'Service-wise') ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm border-y border-gray-200"><tr><th className="p-4 font-bold">Service Name</th><th className="p-4 text-center font-bold">Times Used</th><th className="p-4 text-right font-bold">Base Price</th><th className="p-4 text-right font-bold">Total Revenue Generated</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {serviceData.map((data, index) => (<tr key={index} className="hover:bg-gray-50"><td className="p-4 font-bold text-gray-800">{data.name}</td><td className="p-4 text-center font-medium bg-gray-50 rounded-lg">{data.count}</td><td className="p-4 text-right text-gray-500">₹{data.price.toFixed(0)}</td><td className="p-4 text-right font-extrabold text-[#c08081] text-lg">₹{data.total.toFixed(0)}</td></tr>))}
                            {serviceData.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-500">No service data available.</td></tr>}
                        </tbody></table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                         <table className="min-w-full text-left"><thead className="bg-gray-100 text-gray-600 text-sm border-y border-gray-200"><tr><th className="p-4 font-bold">Invoice #</th><th className="p-4 font-bold">Date</th><th className="p-4 font-bold">Customer Name</th><th className="p-4 font-bold">Payment Method</th><th className="p-4 text-right font-bold">Invoice Total</th></tr></thead>
                         <tbody className="divide-y divide-gray-100">
                            {filteredInvoices.map(inv => (<tr key={inv.id} className="hover:bg-gray-50"><td className="p-4 text-sm text-gray-500 font-medium">#INV-{inv.id}</td><td className="p-4 font-medium">{inv.date}</td><td className="p-4 font-bold text-gray-800">{inv.customerName}</td><td className="p-4"><span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-xs font-bold border border-gray-200">{inv.paymentMode}</span></td><td className="p-4 text-right font-extrabold text-green-600 text-lg">₹{parseFloat(inv.total).toLocaleString()}</td></tr>))}
                            {filteredInvoices.length === 0 && (<tr><td colSpan="5" className="p-8 text-center text-gray-500">No transactions found for this period.</td></tr>)}
                         </tbody></table>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderAiBookingsUI = () => (
    <div className="space-y-6 text-gray-800">
      <div className="rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-rose-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-purple-600 p-3 text-white"><Bot size={26}/></div>
          <div><h3 className="text-xl font-extrabold text-gray-800">SalonMate AI Booking Agent</h3><p className="mt-1 text-sm text-gray-600">These are customer requests collected by the RAG assistant. Confirm only after checking real salon availability.</p></div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {aiBookingRequests.map(request => (
          <div key={request.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-bold text-gray-800">{request.customer_name}</h4><p className="text-sm text-gray-500">{request.phone}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === 'Confirmed' ? 'bg-green-100 text-green-700' : request.status === 'Declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{request.status}</span></div>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-sm"><div><p className="text-xs text-gray-500">Service</p><p className="font-bold">{request.service}</p></div><div><p className="text-xs text-gray-500">Date</p><p className="font-bold">{request.preferred_date}</p></div><div><p className="text-xs text-gray-500">Time</p><p className="font-bold">{request.preferred_time}</p></div></div>
            {request.status === 'Pending review' && <div className="mt-4 flex gap-2"><button onClick={() => updateAiBookingRequest(request.id, 'Confirmed')} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-bold text-white hover:bg-green-700">Confirm</button><button onClick={() => updateAiBookingRequest(request.id, 'Declined')} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300">Decline</button></div>}
          </div>
        ))}
        {aiBookingRequests.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 lg:col-span-2">No AI booking requests yet. Ask SalonMate to book a service, then confirm in the chat.</div>}
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'appointments', icon: Calendar, label: 'Appointments' },
    { id: 'history', icon: History, label: 'History' }, 
    { id: 'billing', icon: Receipt, label: 'Billing' },
    { id: 'services', icon: Scissors, label: 'Services' },
    { id: 'customers', icon: Users, label: 'Customers' },
    { id: 'special', icon: Star, label: 'VIP Customers' },
    { id: 'staff', icon: Briefcase, label: 'Staff' },
    { id: 'expenses', icon: Wallet, label: 'Expenses' },
    { id: 'inventory', icon: Package, label: 'Inventory' },
    { id: 'reports', icon: TrendingUp, label: 'Reports' },
    { id: 'ai-bookings', icon: ClipboardList, label: 'AI Bookings' },
  ];

  if (portalMode === 'customer') return <CustomerPortal onBack={() => setPortalMode('admin')} />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} onCustomerPortal={() => setPortalMode('customer')} />;

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-sans text-gray-800 w-full overflow-hidden">
       {/* Sidebar */}
       <aside className="w-64 bg-white h-full shadow-[4px_0_24px_rgba(0,0,0,0.03)] flex flex-col z-20 flex-shrink-0 relative">
          <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center">
             <div className="w-12 h-12 bg-rose-50 text-[#c08081] rounded-xl flex items-center justify-center mb-3 shadow-inner">
                <Scissors size={24} />
             </div>
             <h1 className="text-2xl font-extrabold text-[#c08081] tracking-tight">SALON <span className="text-gray-800">ERP</span></h1>
             <p className="text-[11px] text-gray-400 mt-1 font-bold uppercase tracking-widest">Management System</p>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
             {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-[#c08081] text-white shadow-lg shadow-rose-200/50 font-bold transform scale-[1.02]' : 'text-gray-500 hover:bg-rose-50 hover:text-[#c08081] font-medium'}`}>
                   <item.icon size={20} className={activeTab === item.id ? "opacity-100" : "opacity-70"} /><span>{item.label}</span>
                </button>
             ))}
          </nav>
          <div className="p-5 border-t border-gray-100 bg-gray-50/50">
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all font-bold shadow-sm"><LogOut size={18} /><span>Secure Logout</span></button>
          </div>
       </aside>
       
       {/* Main Area */}
       <main className="flex-1 flex flex-col h-full bg-[#f8f9fa] min-w-0 overflow-hidden w-full relative">
          {loading && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2"><RefreshCw className="animate-spin" size={14} /><span className="text-xs font-bold tracking-wider uppercase">Syncing Data...</span></div>}
          <header className="bg-white py-4 px-8 shadow-sm border-b border-gray-100 flex justify-between items-center z-10 w-full shrink-0 h-20">
            <div>
                <h2 className="text-2xl font-extrabold text-gray-800 capitalize tracking-tight">{activeTab === 'special' ? 'VIP Customers' : activeTab}</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Manage your {activeTab === 'special' ? 'vip' : activeTab} details</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right hidden md:block">
                <p className="text-sm font-extrabold text-gray-800">{currentUser}</p>
                <p className="text-xs text-[#c08081] font-bold mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div className="h-10 w-px bg-gray-200 mx-1 hidden md:block"></div>
              <button onClick={() => setShowProfileModal(true)} className="h-11 w-11 border-2 border-gray-200 flex items-center justify-center text-gray-500 bg-white rounded-full hover:border-[#c08081] hover:text-[#c08081] transition-all shadow-sm" title="Profile Settings">
                <Settings size={20} />
              </button>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
             <div className="max-w-7xl mx-auto">
                 {activeTab === 'dashboard' && renderDashboard()}
                 {activeTab === 'reports' && renderReportsUI()}
                 {activeTab === 'ai-bookings' && renderAiBookingsUI()}
                 {activeTab === 'appointments' && renderAppointmentsUI()}
                 {activeTab === 'history' && renderHistoryUI()}
                 {activeTab === 'billing' && renderBillingUI()}
                 {activeTab === 'services' && renderServicesUI()}
                 {activeTab === 'customers' && renderCustomersUI()}
                 {activeTab === 'special' && renderSpecialCustomersUI()}
                 {activeTab === 'staff' && renderStaffUI()}
                 {activeTab === 'expenses' && renderExpensesUI()}
                 {activeTab === 'inventory' && renderInventoryUI()}
             </div>
          </div>
       </main>

       {/* Floating Modals */}
       {showReceipt && (<div className="fixed inset-0 bg-gray-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:bg-white print:p-0"><InvoiceReceipt data={billMeta} items={billItems} calculations={calculateBill()} onClose={closeReceipt} /></div>)}
       {showAppointmentDetails && <AppointmentDetailsModal appointment={selectedAppointment} onClose={() => setShowAppointmentDetails(false)} />}
       {showProfileModal && <ProfileSettingsModal username={currentUser} hasSecurityQuestion={hasSecurityQuestion} onClose={() => setShowProfileModal(false)} refreshApp={refreshAllData} />}
       <SalonMateChat />
    </div>
  );
}
