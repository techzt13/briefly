'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// THE MEGA MENU CONFIGURATION
const CATEGORIES = [
  { id: 'technology', label: '💻 Technology' },
  { id: 'finance', label: '📈 Finance' },
  { id: 'crypto', label: '₿ Crypto' },
  { id: 'sports', label: '⚽ Sports' },
  { id: 'ai', label: '🤖 AI & Future' },
  { id: 'business', label: '💼 Business' },
  { id: 'entertainment', label: '🎬 Entertainment' },
  { id: 'health', label: '❤️ Health' },
  { id: 'science', label: '🔬 Science' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'world', label: '🌍 World News' },
  { id: 'politics', label: '⚖️ Politics' },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const toggleCategory = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((item) => item !== id));
    else setSelected([...selected, id]);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (selected.length === 0) {
      setMessage('Please select at least one topic.');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('subscribers')
      .insert([{ email, interests: selected }]);

    if (error) {
      if (error.code === '23505') setMessage('You are already subscribed!');
      else setMessage('Error: ' + error.message);
    } else {
      setMessage('Success! You are on the list.');
      setEmail('');
      setSelected([]);
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 text-gray-900 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Briefly.</h1>
          <p className="text-gray-500">Curate your daily intelligence feed.</p>
        </div>
        <form onSubmit={handleSubscribe} className="space-y-8">
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700 uppercase">Email Address</label>
            <input type="email" placeholder="you@example.com" className="w-full p-4 border rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-bold mb-3 text-gray-700 uppercase">Select your mix</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <label key={cat.id} className={`flex flex-col items-center p-4 border rounded-xl cursor-pointer ${selected.includes(cat.id) ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}>
                  <input type="checkbox" className="hidden" checked={selected.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />
                  <span className="font-semibold text-center">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button disabled={loading} className="w-full bg-black text-white font-bold p-4 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Processing...' : 'Subscribe Free'}
          </button>
          {message && <div className="text-center font-medium p-4">{message}</div>}
        </form>
      </div>
    </main>
  );
}