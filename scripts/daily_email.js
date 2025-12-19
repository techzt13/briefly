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

// --- CONFIGURATION ---
const FEEDS = {
  technology: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  ai: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
  coding: 'https://dev.to/feed',
  startups: 'https://techcrunch.com/category/startups/feed/',
  space: 'https://www.space.com/feeds/news',
  finance: 'https://feeds.content.dowjones.com/public/rss/mw_topstories',
  business: 'http://feeds.bbci.co.uk/news/business/rss.xml',
  crypto: 'https://cointelegraph.com/rss',
  markets: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
  sports: 'https://www.espn.com/espn/rss/news',
  soccer: 'https://www.goal.com/en/feeds/news',
  f1: 'https://www.autosport.com/rss/feed/f1',
  entertainment: 'https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml',
  gaming: 'https://www.gamespot.com/feeds/news/',
  health: 'http://feeds.bbci.co.uk/news/health/rss.xml',
  world: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  politics: 'https://www.politico.com/rss/politicopicks.xml',
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
  f1: { color: '#DC2626', emoji: '🏎️' },
  gaming: { color: '#8B5CF6', emoji: '🎮' },
  health: { color: '#14B8A6', emoji: '🏥' },
  world: { color: '#64748B', emoji: '🌍' },
  politics: { color: '#E11D48', emoji: '⚖️' },
};

function findImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;
  const html = item.contentEncoded || item.content || item.description || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  if (match && match[1]) return match[1];
  return null;
}

// --- SMART GENERATOR: WRITES THE NOTE FOR YOU ---
function generateDailyNote(newsCache) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = days[new Date().getDay()];

  // 1. Find the "Top Story" (Just grab the first item from the first populated category)
  let topStoryTitle = "";
  let topCategory = "";

  for (const [cat, items] of Object.entries(newsCache)) {
    if (items && items.length > 0) {
      topCategory = cat;
      topStoryTitle = items[0].title;
      break;
    }
  }

  // 2. Generate the text
  if (!topStoryTitle) return "Welcome to your daily briefing. Here are the top stories for today.";

  return `Happy ${todayName}! Today we are tracking major updates in ${topCategory.toUpperCase()}. The big story leading the digest is: "${topStoryTitle}". Read on for more.`;
}

async function run() {
  console.log("🚀 Starting Daily Brief...");

  const { data: subscribers } = await supabase.from('subscribers').select('*');
  if (!subscribers || subscribers.length === 0) {
    console.log("No subscribers found.");
    process.exit(0);
  }

  // 1. Fetch News First
  const newsCache = {};
  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      newsCache[category] = feed.items.slice(0, 3);
    } catch (e) { newsCache[category] = []; }
  }

  // 2. Auto-Generate Editor's Note
  const editorsNote = generateDailyNote(newsCache);
  console.log("📝 Auto-Generated Note:", editorsNote);

  // 3. Save Note to DB (Optional: Keeps a history for you)
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('daily_notes').upsert({ date: today, content: editorsNote }, { onConflict: 'date' });

  // 4. Send Emails
  for (const user of subscribers) {
    let emailContent = '';
    let hasContent = false;

    // --- EDITOR'S NOTE SECTION ---
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
        subject: `Briefly: Top Story - ${editorsNote.split('"')[1] ? editorsNote.split('"')[1].substring(0, 20) + '...' : 'Daily Digest'}`,
        html: fullHtml,
      });
      console.log(`✅ Sent to ${user.email}`);
    }
  }
}
run();