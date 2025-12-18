const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const { Resend } = require('resend');

// NOTE: These process.env variables come from GitHub Secrets, NOT your local file
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_KEY);
const parser = new Parser();

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
  console.log("🚀 Starting Daily Brief...");
  const { data: subscribers, error } = await supabase.from('subscribers').select('*');
  if (error) { console.error(error); process.exit(1); }

  const newsCache = {};
  // Fetch news for all categories
  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      newsCache[category] = feed.items.slice(0, 4);
    } catch (e) { newsCache[category] = []; }
  }

  // Generate personalized emails
  for (const user of subscribers) {
    let emailBody = `<h1>Briefly.</h1><p>Your Daily Digest</p>`;
    let hasContent = false;

    if (user.interests) {
      for (const interest of user.interests) {
        if (newsCache[interest]?.length > 0) {
          hasContent = true;
          emailBody += `<h2>${interest.toUpperCase()}</h2>`;
          newsCache[interest].forEach(item => {
            emailBody += `<p><a href="${item.link}">${item.title}</a></p>`;
          });
        }
      }
    }

    if (hasContent) {
      await resend.emails.send({
        from: 'Briefly <onboarding@resend.dev>',
        to: [user.email],
        subject: 'Your Daily Briefly',
        html: emailBody,
      });
      console.log(`Sent to ${user.email}`);
    }
  }
}
run();