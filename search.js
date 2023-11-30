const sqlite3 = require('sqlite3').verbose();

// Connect to the SQLite database
const db = new sqlite3.Database('crawldata.db');

// Function to search for an exact term in the database
function searchDatabase(term) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM crawled_data
      WHERE title = ? COLLATE NOCASE OR description = ? COLLATE NOCASE
    `;

    db.all(query, [term, term], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get the search term from the command line arguments
const searchTerm = process.argv.slice(2).join(' ').trim(); // Handle multiple words in the search term and trim whitespace

if (!searchTerm) {
  console.error('Please provide a search term.');
  process.exit(1);
}

// Perform the search
searchDatabase(searchTerm)
  .then(results => {
    console.log(`Search results for "${searchTerm}":`);
    results.forEach(result => {
      console.log(`URL: ${result.url}\nTitle: ${result.title}\nDescription: ${result.description}\n`);
    });
  })
  .catch(error => {
    console.error(`Search failed: ${error.message}`);
  })
  .finally(() => {
    // Close the SQLite database connection after the search is completed
    db.close();
  });
