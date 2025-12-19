const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');

// 1. Setup Database
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ CRITICAL ERROR: Supabase Secrets are missing.");
  process.exit(1);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 2. Setup Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const parser = new Parser({
  customFields: {
    item: [['media:content', 'media'], ['enclosure', 'enclosure'], ['content:encoded', 'contentEncoded'], ['content', 'content'], ['description', 'description']],
  },
});

// --- GRANULAR CATEGORIES (Sub-Niched) ---
const FEEDS = {
  // --- TECH ---
  tech_general: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  tech_ai: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
  tech_coding: 'https://dev.to/feed',
  tech_mobile: 'https://www.gsmarena.com/rss-news-reviews.php3',
  tech_gadgets: 'https://www.theverge.com/rss/index.xml',

  // --- CRYPTO & FINANCE ---
  finance_markets: 'https://feeds.content.dowjones.com/public/rss/mw_topstories',
  finance_vc: 'https://techcrunch.com/category/venture/feed/',
  crypto_general: 'https://cointelegraph.com/rss',
  crypto_bitcoin: 'https://news.bitcoin.com/feed/',
  crypto_ethereum: 'https://weekinethereumnews.com/rss/',

  // --- SPORTS ---
  sports_general: 'https://www.espn.com/espn/rss/news',
  sports_soccer: 'https://www.goal.com/en/feeds/news',
  sports_tennis: 'https://www.tennis.com/rss',
  sports_nfl: 'https://www.nfl.com/rss/rsslanding?searchString=home',
  sports_nba: 'https://www.nba.com/rss/nba_rss.xml',
  sports_f1: 'https://www.autosport.com/rss/feed/f1',
  sports_golf: 'https://www.golfchannel.com/rss/news',

  // --- SCIENCE ---
  science_space: 'https://www.space.com/feeds/news',
  science_neuroscience: 'https://www.sciencedaily.com/rss/mind_brain/neuroscience.xml',
  science_environment: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',

  // --- LIFESTYLE ---
  life_gaming: 'https://www.gamespot.com/feeds/news/',
  life_movies: 'https://www.cinemablend.com/rss/news',
  life_travel: 'https://www.travelandleisure.com/feed/sc/feed',
  life_cars: 'https://www.autocar.co.uk/rss',
};

// --- STYLES FOR SUB-CATEGORIES ---
const CATEGORY_STYLES = {
  default: { color: '#6B7280', emoji: '📰' },

  // Tech
  tech_general: { color: '#2563EB', emoji: '💻' },
  tech_ai: { color: '#7C3AED', emoji: '🤖' },
  tech_coding: { color: '#10B981', emoji: '👨‍💻' },
  tech_mobile: { color: '#3B82F6', emoji: '📱' },
  tech_gadgets: { color: '#6366F1', emoji: '⌚' },

  // Finance/Crypto
  finance_markets: { color: '#059669', emoji: '📈' },
  finance_vc: { color: '#059669', emoji: '💰' },
  crypto_general: { color: '#F59E0B', emoji: '🪙' },
  crypto_bitcoin: { color: '#F7931A', emoji: '₿' }, // Bitcoin Orange
  crypto_ethereum: { color: '#3C3C3D', emoji: 'Ξ' }, // Eth symbol

  // Sports
  sports_general: { color: '#EF4444', emoji: '🏆' },
  sports_soccer: { color: '#10B981', emoji: '⚽' },
  sports_tennis: { color: '#84CC16', emoji: '🎾' },
  sports_nfl: { color: '#991B1B', emoji: '🏈' },
  sports_nba: { color: '#EA580C', emoji: '🏀' },
  sports_f1: { color: '#DC2626', emoji: '🏎️' },
  sports_golf: { color: '#15803D', emoji: '⛳' },

  // Science/Life
  science_space: { color: '#4B5563', emoji: '🪐' },
  science_neuroscience: { color: '#DB2777', emoji: '🧠' },
  life_gaming: { color: '#8B5CF6', emoji: '🎮' },
  life_movies: { color: '#BE185D', emoji: '🎬' },
  life_cars: { color: '#B91C1C', emoji: '🚗' },
};

function findImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;
  const html = item.contentEncoded || item.content || item.description || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  if (match && match[1]) return match[1];
  return null;
}

// --- SMART GENERATOR ---
function generateDailyNote(newsCache) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = days[new Date().getDay()];

  let topStoryTitle = "";
  let topCategory = "";

  for (const [cat, items] of Object.entries(newsCache)) {
    if (items && items.length > 0) {
      topCategory = cat.replace('_', ' '); // Turn "tech_ai" into "tech ai"
      topStoryTitle = items[0].title;
      break;
    }
  }

  if (!topStoryTitle) return "Welcome to your daily briefing. Here are the top stories for today.";

  return `Happy ${todayName}! Today we are tracking updates in ${topCategory.toUpperCase()}. The lead story is: "${topStoryTitle}".`;
}

async function run() {
  console.log("🚀 Starting Granular Daily Brief...");

  const { data: subscribers } = await supabase.from('subscribers').select('*');
  if (!subscribers || subscribers.length === 0) {
    console.log("No subscribers found.");
    process.exit(0);
  }

  // 1. Fetch News
  const newsCache = {};
  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      newsCache[category] = feed.items.slice(0, 3);
    } catch (e) { newsCache[category] = []; }
  }

  // 2. Auto-Generate Note
  const editorsNote = generateDailyNote(newsCache);
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('daily_notes').upsert({ date: today, content: editorsNote }, { onConflict: 'date' });

  // 3. Send Emails
  for (const user of subscribers) {
    let emailContent = '';
    let hasContent = false;

    // --- EDITOR'S NOTE ---
    emailContent += `
      <div style="background-color: #F3F4F6; border-left: 4px solid #000; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; color: #4B5563; letter-spacing: 1px;">Daily Briefing</h3>
        <p style="margin: 0; font-size: 16px; color: #111827; font-family: Georgia, serif; line-height: 1.5; font-style: italic;">
          "${editorsNote}"
        </p>
      </div>
    `;

    if (user.interests) {
      for (const interest of user.interests) {
        if (newsCache[interest]?.length > 0) {
          hasContent = true;
          const style = CATEGORY_STYLES[interest] || CATEGORY_STYLES.default;
          // Format label: "sports_tennis" -> "SPORTS TENNIS"
          const displayLabel = interest.replace('_', ' ').toUpperCase();

          emailContent += `
            <div style="margin: 30px 0 15px 0;">
              <span style="background-color: ${style.color}; color: #fff; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; text-transform: uppercase; font-family: Helvetica, Arial, sans-serif;">
                ${style.emoji} ${displayLabel}
              </span>
            </div>
          `;

          newsCache[interest].forEach(item => {
            const imageUrl = findImage(item);
            let cardHtml = '';

            if (imageUrl) {
               cardHtml = `
                <a href="${item.link}" style="text-decoration: none; color: inherit; display: block; margin-bottom: 20px;">
                  <div style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden;">
                    <div style="height: 200px; width: 100%; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
                    <div style="padding: 20px;">
                      <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 18px; line-height: 1.4; font-weight: 700; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${item.title}</h3>
                      <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.6;">Click to read &rarr;</p>
                    </div>
                  </div>
                </a>`;
            } else {
               cardHtml = `
                <a href="${item.link}" style="text-decoration: none; color: inherit; display: block; margin-bottom: 15px;">
                  <div style="background: #F9FAFB; border-left: 4px solid ${style.color}; border-radius: 8px; padding: 16px;">
                    <h3 style="margin: 0; color: #1F2937; font-size: 16px; font-weight: 600; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${item.title}</h3>
                    <p style="margin: 6px 0 0 0; color: #6B7280; font-size: 12px;">Read more &rarr;</p>
                  </div>
                </a>`;
            }
            emailContent += cardHtml;
          });
        }
      }
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding-bottom: 40px;">
          <div style="background-color: #000000; padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 40px; font-weight: 800; letter-spacing: -2px;">Briefly.</h1>
            <p style="color: #9CA3AF; margin: 10px 0 0 0; font-size: 14px; text-transform: uppercase;">The World's Best Daily Digest</p>
          </div>
          <div style="padding: 10px 30px;">
            ${emailContent}
          </div>
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px;">© 2024 Briefly Inc.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (hasContent) {
      await transporter.sendMail({
        from: `"Briefly News" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `Briefly: ${editorsNote.split('"')[1] ? editorsNote.split('"')[1].substring(0, 30) + '...' : 'Your Digest'}`,
        html: fullHtml,
      });
      console.log(`✅ Sent to ${user.email}`);
    }
  }
}
run();