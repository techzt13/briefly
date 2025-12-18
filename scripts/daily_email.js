const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');

// 1. Setup Database
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 2. Setup Gmail Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Custom parser to try and get images
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['enclosure', 'enclosure'],
    ],
  },
});

// 3. Vibrant Color Palette & Icons
const CATEGORY_STYLES = {
  technology: { color: '#3B82F6', emoji: '💻' }, // Blue
  finance:    { color: '#10B981', emoji: '💰' }, // Green
  crypto:     { color: '#F59E0B', emoji: '🪙' }, // Gold
  sports:     { color: '#EF4444', emoji: '⚽' }, // Red
  ai:         { color: '#8B5CF6', emoji: '🤖' }, // Purple
  business:   { color: '#6366F1', emoji: '👔' }, // Indigo
  entertainment: { color: '#EC4899', emoji: '🎬' }, // Pink
  health:     { color: '#14B8A6', emoji: '🏥' }, // Teal
  science:    { color: '#06B6D4', emoji: '🧬' }, // Cyan
  gaming:     { color: '#A855F7', emoji: '🎮' }, // Violet
  world:      { color: '#64748B', emoji: '🌍' }, // Slate
  politics:   { color: '#F43F5E', emoji: '⚖️' }, // Rose
  default:    { color: '#6B7280', emoji: '📰' }  // Gray
};

const FEEDS = {
  technology: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  finance: 'https://feeds.content.dowjones.com/public/rss/mw_topstories',
  crypto: 'https://cointelegraph.com/rss',
  sports: 'https://www.espn.com/espn/rss/news',
  ai: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
  business: 'http://feeds.bbci.co.uk/news/business/rss.xml',
  entertainment: 'https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml',
  health: 'http://feeds.bbci.co.uk/news/health/rss.xml',
  science: 'https://www.sciencedaily.com/rss/top/science.xml',
  gaming: 'https://www.gamespot.com/feeds/news/',
  world: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  politics: 'http://feeds.bbci.co.uk/news/politics/rss.xml'
};

// Helper to find an image in the RSS feed
function extractImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;
  // Fallback image if none found
  return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=600&q=80';
}

async function run() {
  console.log("🚀 Starting Daily Brief (Pro Design)...");

  const { data: subscribers, error } = await supabase.from('subscribers').select('*');
  if (error) { console.error(error); process.exit(1); }

  const newsCache = {};

  // Fetch News
  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      newsCache[category] = feed.items.slice(0, 3); // Top 3 stories per category
    } catch (e) { newsCache[category] = []; }
  }

  // Send Emails
  for (const user of subscribers) {
    let emailContent = '';
    let hasContent = false;

    if (user.interests) {
      for (const interest of user.interests) {
        if (newsCache[interest]?.length > 0) {
          hasContent = true;
          const style = CATEGORY_STYLES[interest] || CATEGORY_STYLES.default;

          // CATEGORY HEADER
          emailContent += `
            <div style="margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid ${style.color}; padding-bottom: 5px;">
              <h2 style="color: ${style.color}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; text-transform: uppercase; margin: 0;">
                ${style.emoji} ${interest}
              </h2>
            </div>
          `;

          // ARTICLES (Cards)
          newsCache[interest].forEach(item => {
            const imageUrl = extractImage(item);
            emailContent += `
              <a href="${item.link}" style="text-decoration: none; color: inherit;">
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <div style="height: 160px; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>

                  <div style="padding: 15px;">
                    <h3 style="margin: 0 0 10px 0; color: #111827; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; line-height: 1.4;">
                      ${item.title}
                    </h3>
                    <p style="margin: 0; color: #6B7280; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                      Click to read more →
                    </p>
                  </div>
                </div>
              </a>
            `;
          });
        }
      }
    }

    // THE FULL HTML TEMPLATE
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">

                <tr>
                  <td style="background-color: #111827; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Briefly.</h1>
                    <p style="color: #9CA3AF; margin: 10px 0 0 0; font-size: 14px;">Your Curated Daily Digest</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px;">
                    ${emailContent}
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                      You received this because you are awesome. <br>
                      © 2024 Briefly News. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>

              <div style="height: 40px;"></div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (hasContent) {
      try {
        await transporter.sendMail({
          from: `"Briefly News" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: 'Your Daily Briefly 🚀', // Added rocket emoji
          html: fullHtml,
        });
        console.log(`✅ Sent to ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${user.email}:`, err.message);
      }
    }
  }
}
run();