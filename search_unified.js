const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const url = require('url');

const webDb = new sqlite3.Database('crawldata_web.db');
const imageDb = new sqlite3.Database('crawldata_image.db');

const webQuery = `
SELECT url, title, description, backlinks
FROM crawled_data
WHERE title LIKE ? OR description LIKE ?
ORDER BY backlinks DESC
`;

const imageQuery = `
SELECT url, title, alt, backlinks
FROM crawled_data
WHERE title LIKE ?
ORDER BY backlinks DESC, title
`;

function searchDatabase(db, query, term) {
    return new Promise((resolve, reject) => {
        const placeholders = query.split('?').length - 1;
        const values = Array(placeholders).fill(`%${term}%`);
        db.all(query, values, (err, rows) => {
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

app.get('/web', (req, res) => {
    const searchTerm = req.query.q;
    const site = req.query.site;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Please provide a search term.' });
    }

    searchDatabase(webDb, webQuery, searchTerm)
        .then(results => {
            let modifiedResults = results.map(result => ({
                url: result.url,
                title: result.title,
                description: result.description,
                rank: result.backlinks,
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

app.get('/image', (req, res) => {
    const searchTerm = req.query.q;
    const site = req.query.site;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Please provide a search term.' });
    }

    searchDatabase(imageDb, imageQuery, searchTerm)
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