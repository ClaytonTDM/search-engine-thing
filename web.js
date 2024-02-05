const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const robots = require('robots');
const process = require('process');
const { URL } = require('url');

// Create and connect to a SQLite database
const db = new sqlite3.Database('crawldata_web.db');

// Create a table to store crawled data
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS crawled_data (url TEXT, title TEXT, description TEXT, backlinks INTEGER)");
});

// Extract the starting URL from the command line arguments
const startUrl = process.argv[2];
const filterUrl = process.argv[3];

if (!startUrl) {
  console.error('Usage: node web.js <starting-url>');
  process.exit(1);
}

const visitedUrls = new Set();
const robotsParser = new robots.RobotsParser();

async function crawl(url, retryCount = 0) {
  try {
    // Check if the URL has already been visited
    if (visitedUrls.has(url)) {
      return;
    }

    console.log(`Crawling: ${url}`); // Log the current URL
    visitedUrls.add(url);

    // Fetch and parse robots.txt for the current URL
    const domainUrl = new URL(url);
    const robotsUrl = `${domainUrl.protocol}//${domainUrl.hostname}/robots.txt`;
    let isAllowed = true; // Assume allowed if robots.txt is unreachable

    await new Promise((resolve, reject) => {
      robotsParser.setUrl(robotsUrl, (parser, success) => {
        if (success) {
          parser.canFetch('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', url, (access) => {
            isAllowed = access;
            resolve();
          });
        } else {
          console.warn(`Failed to fetch or parse robots.txt for ${url}. Treating as allowed.`);
          resolve();
        }
      });
    });

    if (!isAllowed) {
      console.log(`Crawling disallowed by robots.txt for ${url}`);
      return;
    }

    // URL is allowed since robots.txt fetch or parse was successful or failed
    const response = await axios.get(url, {
      maxRedirects: 10,
      validateStatus: status => status < 400,
    });

    const $ = cheerio.load(response.data);

    // Extract metadata
    const title = $('head title').text();
    let description = $('head meta[name="description"]').attr('content') || 'Error: Description not available';
    description = description.substring(0, 200);

    // Save data to SQLite database if the URL does not contain the filterUrl
    if (!url.includes(filterUrl) && !title.includes('Google Image Result for')) {
      db.run("INSERT INTO crawled_data (url, title, description, backlinks) VALUES (?, ?, ?, 0)", [url, title, description]);
    }

    // Extract links and crawl recursively
    const links = [];
    $('a').each((_, element) => {
      const link = $(element).attr('href');
      if (link && link.startsWith('http')) {
        links.push(link);
        // Increment the backlink count for each page that links to the current page
        db.run("UPDATE crawled_data SET backlinks = backlinks + 1 WHERE url = ?", [link]);
      }
    });

    // Use Promise.all to crawl links concurrently
    await Promise.all(links.map(link => crawl(link)));

    // Increment the backlink count for each page that links to the current page
    db.run("UPDATE crawled_data SET backlinks = backlinks + 1 WHERE url = ?", [url]);

    console.log(`Saved to database: ${url}`);
  } catch (error) {
    console.error(`Error crawling ${url}: ${error.message}`);
    if (retryCount < 2) {
      console.log(`Retrying ${url}`);
      await crawl(url, retryCount + 1);
    }
  }
}

// Start crawling
crawl(startUrl)
  .then(() => {
    console.log('Crawling completed.');
    db.close();
    process.exit(0);
  })
  .catch(error => {
    console.error(`Crawling failed: ${error.message}`);
    db.close();
    process.exit(1);
  });