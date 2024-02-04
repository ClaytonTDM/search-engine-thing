const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const url = require('url');

const db = new sqlite3.Database('crawldata_image.db');
const query = `
SELECT url, title, alt, backlinks
FROM crawled_data
WHERE title LIKE ?
ORDER BY backlinks DESC, title
`;

function searchDatabase(term) {
  return new Promise((resolve, reject) => {
    db.all(query, [`%${term}%`], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

const app = express();

app.use(cors());

app.get('/search', (req, res) => {
  const searchTerm = req.query.q;
  const site = req.query.site;

  if (!searchTerm) {
    return res.status(400).json({ error: 'Please provide a search term.' });
  }

  searchDatabase(searchTerm)
    .then(results => {
      let modifiedResults = results.map(result => ({
        url: result.url,
        title: result.title,
        alt: result.alt,
        backlinks: result.backlinks,
      }));

      // If a site was specified, filter the results to only include those from that site
      if (site) {
        modifiedResults = modifiedResults.filter(result => {
          const resultUrl = url.parse(result.url);
          const siteUrl = url.parse(`http://${site}`); // Add http:// to ensure correct parsing
          return resultUrl.hostname === siteUrl.hostname;
        });
      }

      res.json(modifiedResults);
    })
    .catch(error => {
      res.status(500).json({ error: `Search failed: ${error.message}` });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));