const fs = require('fs');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const url = require('url');
const { spawn } = require('child_process');
let delay = 1;

const reset = process.argv[2];
if (reset == 'true') {
    fs.unlink('crawldata_web.db', (err) => {
        if (err) {
            console.error(err);
            return;
        }
    });
    fs.unlink('crawldata_image.db', (err) => {
        if (err) {
            console.error(err);
            return;
        }
    });
    fs.unlink('history_image.db', (err) => {
        if (err) {
            console.error(err);
            return;
        }
    });
    fs.unlink('history_web.db', (err) => {
        if (err) {
            console.error(err);
            return;
        }
    });
}

const webDb = new sqlite3.Database('crawldata_web.db');
// const imageDb = new sqlite3.Database('crawldata_image.db');
const historyDbImage = new sqlite3.Database('history_image.db');
const historyDbWeb = new sqlite3.Database('history_web.db');


const webQuery = `
SELECT url, title, description, backlinks
FROM crawled_data
WHERE title LIKE ? OR description LIKE ?
ORDER BY backlinks DESC
`;

// const imageQuery = `
// SELECT url, title, alt, backlinks
// FROM crawled_data
// WHERE title LIKE ? OR alt LIKE ?
// ORDER BY backlinks DESC, title
// `;

const insertQuery = `INSERT INTO history (term) VALUES (?)`;

// historyDbImage.serialize(() => {
//     historyDbImage.run("CREATE TABLE IF NOT EXISTS history (term TEXT)");
// });
historyDbWeb.serialize(() => {
    historyDbWeb.run("CREATE TABLE IF NOT EXISTS history (term TEXT)");
});

function searchDatabase(db, query, ...terms) {
    return new Promise((resolve, reject) => {
        const placeholders = query.split('?').length - 1;
        const values = Array(placeholders).fill().map((_, i) => `%${terms[i % terms.length]}%`);
        db.all(query, values, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                // add each term to history if the db doesnt already contain it
                terms.forEach(term => {
                    if (db == webDb) {
                        historyDbWeb.get('SELECT * FROM history WHERE term = ?', [term], (err, row) => {
                            if (!row) {
                                historyDbWeb.run(insertQuery, [term]);
                            }
                        });
                    } else if (db == imageDb) {
                        historyDbImage.get('SELECT * FROM history WHERE term = ?', [term], (err, row) => {
                            if (!row) {
                                historyDbImage.run(insertQuery, [term]);
                            }
                        });
                    }
                });
                resolve(rows);
            }
        });
    });
}

const app = express();

app.use(cors());

app.get('/web', (req, res) => {
    const searchTerm = req.query.q;
    const depth = req.query.d;
    const site = req.query.site;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Please provide a search term.' });
    }
    historyDbWeb.get('SELECT * FROM history WHERE term = ?', [searchTerm], (err, row) => {
        if (!row) {
            delay = depth * 10e3;
            childProcessBrave = spawn('node', ['web.js', 'https://search.brave.com/search?q=' + encodeURIComponent(searchTerm), 'search.brave.com/search']);
            childProcessBrave.on('error', (error) => {
                console.log(`error: ${error.message}`);
            });
            childProcessBrave.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            childProcessBrave.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });

            childProcessGoogle = spawn('node', ['web.js', 'https://google.com/search?q=' + encodeURIComponent(searchTerm), 'google.com/search']);
            childProcessGoogle.on('error', (error) => {
                console.log(`error: ${error.message}`);
            });
            childProcessGoogle.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            childProcessGoogle.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });

            childProcessDuckDuckGo = spawn('node', ['web.js', 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(searchTerm), 'lite.duckduckgo.com']);
            childProcessDuckDuckGo.on('error', (error) => {
                console.log(`error: ${error.message}`);
            });
            childProcessDuckDuckGo.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            childProcessDuckDuckGo.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });
            setTimeout(() => {
                childProcessBrave.kill();
                childProcessGoogle.kill();
                childProcessDuckDuckGo.kill();
            }, depth * 10e3);
        } else {
            delay = 1;
        }

        setTimeout(() => {
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
        }, delay);
    });
});
/*
app.get('/image', (req, res) => {
    const searchTerm = req.query.q;
    const site = req.query.site;
    const depth = req.query.d;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Please provide a search term.' });
    }

    historyDbImage.get('SELECT * FROM history WHERE term = ?', [searchTerm], (err, row) => {
        if (!row) {
            delay = depth * 10e3;
            childProcessStartpage = spawn('node', ['image.js', 'https://www.startpage.com/sp/search?cat=images&q=' + encodeURIComponent(searchTerm), 'startpage.com/sp/search']);
            childProcessStartpage.on('error', (error) => {
                console.log(`error: ${error.message}`);
            });
            childProcessStartpage.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            childProcessStartpage.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });

            setTimeout(() => {
                childProcessStartpage.kill();
            }, depth * 10e3);
        } else {
            delay = 1;
        }

        setTimeout(() => {
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
        }, delay);
    });
});
*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));