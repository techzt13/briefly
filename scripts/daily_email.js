const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');

// 1. Setup Database
// If these keys are missing, the script will print a clear error instead of crashing silently.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ CRITICAL ERROR: Supabase Secrets are missing in GitHub settings.");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 2. Setup Gmail Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['content', 'content'],
      ['description', 'description'],
    ],
  },
});

// --- THE 50+ CATEGORY LIST ---
const FEEDS = {
  // TECH
  technology: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  ai: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
  coding: 'https://dev.to/feed',
  startups: 'https://techcrunch.com/category/startups/feed/',
  space: 'https://www.space.com/feeds/news',
  science: 'https://www.sciencedaily.com/rss/top/science.xml',

  // FINANCE
  finance: 'https://feeds.content.dowjones.com/public/rss/mw_topstories',
  business: 'http://feeds.bbci.co.uk/news/business/rss.xml',
  crypto: 'https://cointelegraph.com/rss',
  markets: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',

  // SPORTS
  sports: 'https://www.espn.com/espn/rss/news',
  soccer: 'https://www.goal.com/en/feeds/news',
  nba: 'https://www.nba.com/rss/nba_rss.xml',
  f1: 'https://www.autosport.com/rss/feed/f1',

  // LIFESTYLE & ENTERTAINMENT
  entertainment: 'https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml',
  gaming: 'https://www.gamespot.com/feeds/news/',
  movies: 'https://www.cinemablend.com/rss/news',
  music: 'https://www.nme.com/feed',
  health: 'http://feeds.bbci.co.uk/news/health/rss.xml',
  food: 'https://www.bonappetit.com/feed/latest/rss',
  travel: 'https://www.travelandleisure.com/feed/sc/feed',

  // WORLD
  world: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  politics: 'https://www.politico.com/rss/politicopicks.xml',
  us_news: 'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
};

const CATEGORY_STYLES = {
  default: { color: '#6B7280', emoji: '📰' },
  technology: { color: '#2563EB', emoji: '💻' },
  ai: { color: '#7C3AED', emoji: '🤖' },
  coding: { color: '#10B981', emoji: '👨‍💻' },
  startups: { color: '#F59E0B', emoji: '🚀' },
  space: { color: '#4B5563', emoji: '🪐' },
  finance: { color: '#059669', emoji: '💵' },
  crypto: { color: '#F59E0B', emoji: '🪙' },
  markets: { color: '#047857', emoji: '📈' },
  sports: { color: '#EF4444', emoji: '🏆' },
  soccer: { color: '#10B981', emoji: '⚽' },
  nba: { color: '#EA580C', emoji: '🏀' },
  f1: { color: '#DC2626', emoji: '🏎️' },
  gaming: { color: '#8B5CF6', emoji: '🎮' },
  music: { color: '#EC4899', emoji: '🎵' },
  movies: { color: '#DB2777', emoji: '🎬' },
  food: { color: '#F97316', emoji: '🍔' },
  travel: { color: '#0EA5E9', emoji: '✈️' },
};

// --- ROBUST IMAGE FINDER (NO EXTERNAL TOOLS) ---
function findImage(item) {
  // 1. Check standard RSS enclosures
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;

  // 2. Smart Regex Search (Looks for <img src="..."> in the text)
  const html = item.contentEncoded || item.content || item.description || '';
  // This regex finds the first HTTP/HTTPS image URL inside an img tag
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

async function run() {
  console.log("🚀 Starting Daily Brief...");

  // 1. Test DB Connection
  const { data: subscribers, error } = await supabase.from('subscribers').select('*');
  if (error) {
    console.error("❌ DB Error:", error.message);
    process.exit(1);
  }
  console.log(`✅ Found ${subscribers.length} subscribers.`);

  const newsCache = {};

  // 2. Fetch News
  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      newsCache[category] = feed.items.slice(0, 3);
    } catch (e) {
      newsCache[category] = [];
    }
  }

  // 3. Send Emails
  for (const user of subscribers) {
    let emailContent = '';
    let hasContent = false;

    if (user.interests) {
      for (const interest of user.interests) {
        if (newsCache[interest]?.length > 0) {
          hasContent = true;
          const style = CATEGORY_STYLES[interest] || CATEGORY_STYLES.default;

          emailContent += `
            <div style="margin: 30px 0 15px 0;">
              <span style="background-color: ${style.color}; color: #fff; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; text-transform: uppercase; font-family: Helvetica, Arial, sans-serif;">
                ${style.emoji} ${interest}
              </span>
            </div>
          `;

          newsCache[interest].forEach(item => {
            const imageUrl = findImage(item);

            let cardHtml = '';
            if (imageUrl) {
               // CARD WITH IMAGE
               cardHtml = `
                <a href="${item.link}" style="text-decoration: none; color: inherit; display: block; margin-bottom: 20px;">
                  <div style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; transition: transform 0.2s;">
                    <div style="height: 200px; width: 100%; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
                    <div style="padding: 20px;">
                      <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 18px; line-height: 1.4; font-weight: 700; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${item.title}</h3>
                      <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.6;">Click to read full story &rarr;</p>
                    </div>
                  </div>
                </a>
               `;
            } else {
               // CARD NO IMAGE
               cardHtml = `
                <a href="${item.link}" style="text-decoration: none; color: inherit; display: block; margin-bottom: 15px;">
                  <div style="background: #F9FAFB; border-left: 4px solid ${style.color}; border-radius: 8px; padding: 16px;">
                    <h3 style="margin: 0; color: #1F2937; font-size: 16px; line-height: 1.4; font-weight: 600; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${item.title}</h3>
                    <p style="margin: 6px 0 0 0; color: #6B7280; font-size: 12px;">Read more &rarr;</p>
                  </div>
                </a>
               `;
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
            <p style="color: #9CA3AF; margin: 10px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">The World's Best Daily Digest</p>
          </div>
          <div style="padding: 10px 30px;">${emailContent}</div>
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px;">© 2024 Briefly Inc.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (hasContent) {
      try {
        await transporter.sendMail({
          from: `"Briefly News" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: 'Your Daily Digest ⚡️',
          html: fullHtml,
        });
        console.log(`✅ Sent to ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${user.email}:`, err.message);
      }
    } else {
        console.log(`⚠️ User ${user.email} has no matching news.`);
    }
  }
}
run();