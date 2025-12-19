'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- SYNCED WITH BACKEND ---
const CATEGORY_GROUPS = [
  {
    title: "🌍 World & Politics",
    items: [
      { id: 'world_general', label: 'World News' },
      { id: 'world_us', label: 'U.S. News' },
      { id: 'politics_general', label: 'Politics' },
    ]
  },
  {
    title: "💼 Business & Finance",
    items: [
      { id: 'business_general', label: 'Business' },
      { id: 'finance_markets', label: 'Markets' },
      { id: 'finance_vc', label: 'Venture Capital' },
    ]
  },
  {
    title: "₿ Crypto",
    items: [
      { id: 'crypto_general', label: 'Crypto News' },
      { id: 'crypto_bitcoin', label: 'Bitcoin' },
      { id: 'crypto_ethereum', label: 'Ethereum' },
    ]
  },
  {
    title: "💻 Technology & AI",
    items: [
      { id: 'tech_general', label: 'Tech News' },
      { id: 'tech_ai', label: 'AI & Future' },
      { id: 'tech_coding', label: 'Coding' },
      { id: 'tech_mobile', label: 'Mobile' },
    ]
  },
  {
    title: "⚽ Sports",
    items: [
      { id: 'sports_general', label: 'Top Sports' },
      { id: 'sports_soccer', label: 'Soccer' },
      { id: 'sports_nba', label: 'NBA' },
      { id: 'sports_nfl', label: 'NFL' },
      { id: 'sports_f1', label: 'F1' },
      { id: 'sports_tennis', label: 'Tennis' },
    ]
  },
  {
    title: "🔬 Science & Health",
    items: [
      { id: 'health_general', label: 'Health' },
      { id: 'science_general', label: 'Science' },
      { id: 'science_space', label: 'Space' },
    ]
  },
  {
    title: "🎬 Lifestyle & Entertainment",
    items: [
      { id: 'entertainment_general', label: 'Entertainment' },
      { id: 'life_gaming', label: 'Gaming' },
      { id: 'life_movies', label: 'Movies' },
      { id: 'life_travel', label: 'Travel' },
      { id: 'life_cars', label: 'Cars' },
    ]
  }
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const toggleCategory = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || selected.length === 0) return;

    setStatus('loading');

    // 1. Check if user exists
    const { data: existing } = await supabase
      .from('subscribers')
      .select('*')
      .eq('email', email)
      .single();

    let error;

    if (existing) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('subscribers')
        .update({ interests: selected })
        .eq('email', email);
      error = updateError;
    } else {
      // Create new user
      const { error: insertError } = await supabase
        .from('subscribers')
        .insert([{ email, interests: selected }]);
      error = insertError;
    }

    if (error) {
      console.error(error);
      setStatus('error');
    } else {
      setStatus('success');
      setEmail('');
      setSelected([]);
    }
  };

  return (
    <main className="min-h-screen bg-[#F3F4F6] flex flex-col items-center py-20 px-4 font-sans text-gray-900">

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold tracking-tighter text-black mb-4">Briefly.</h1>
        <p className="text-xl text-gray-500 font-medium">Your personalized daily digest.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-8 border border-gray-200">

        {status === 'success' ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-3xl font-bold mb-2">You're on the list!</h2>
            <p className="text-gray-500">Watch your inbox for your first briefing.</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-8 text-blue-600 font-semibold hover:underline"
            >
              Subscribe another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="space-y-8">

            {/* Email Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                1. Enter your email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:outline-none text-lg transition-all"
              />
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                2. Choose your mix
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CATEGORY_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">{group.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`
                            px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border
                            ${selected.includes(cat.id)
                              ? 'bg-black text-white border-black shadow-md'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }
                          `}
                        >
                          {selected.includes(cat.id) && <span className="mr-2">✓</span>}
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === 'loading' || !email || selected.length === 0}
              className={`
                w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all
                ${status === 'loading'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800 hover:scale-[1.01] shadow-lg'
                }
              `}
            >
              {status === 'loading' ? 'Setting up...' : 'Start My Subscription'}
            </button>

            {status === 'error' && (
              <p className="text-center text-red-500 text-sm font-medium">
                Something went wrong. Please try again.
              </p>
            )}
          </form>
        )}
      </div>

      <div className="mt-12 text-center text-gray-400 text-sm">
        <p>© 2024 Briefly Inc. No spam, ever.</p>
      </div>
    </main>
  );
}