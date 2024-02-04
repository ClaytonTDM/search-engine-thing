const fs = require('fs');

fs.readFile('top_sites.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    const jsonData = JSON.parse(data);
    const urls = jsonData.sites.map(site => site.domain);
    const jsonUrls = JSON.stringify(urls);
    console.log(jsonUrls);
});