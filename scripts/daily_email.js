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

const parser = new Parser();

// RSS Feeds Source List
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

async function run() {
  console.log("🚀 Starting Daily Brief via Gmail...");

  // Get all subscribers
  const { data: subscribers, error } = await supabase.from('subscribers').select('*');
  if (error) { console.error(error); process.exit(1); }

  const newsCache = {};

  // Fetch News
  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      newsCache[category] = feed.items.slice(0, 4);
    } catch (e) { newsCache[category] = []; }
  }

  // Send Emails
  for (const user of subscribers) {
    let emailBody = `<h1 style="font-family: sans-serif;">Briefly.</h1><p>Your Daily Digest</p>`;
    let hasContent = false;

    if (user.interests) {
      for (const interest of user.interests) {
        if (newsCache[interest]?.length > 0) {
          hasContent = true;
          emailBody += `<h2 style="text-transform: capitalize;">${interest}</h2>`;
          newsCache[interest].forEach(item => {
            emailBody += `<p><a href="${item.link}">${item.title}</a></p>`;
          });
        }
      }
    }

    if (hasContent) {
      try {
        // Sends email appearing as "Briefly News"
        await transporter.sendMail({
          from: `"Briefly News" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: 'Your Daily Briefly',
          html: emailBody,
        });
        console.log(`✅ Sent to ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${user.email}:`, err.message);
      }
    }
  }
}
run();