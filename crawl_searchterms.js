const { spawn } = require('child_process');
const fs = require('fs');

fs.readFile('top_searchterms.json', 'utf8', (err, data) => {
    if (err) {
        console.log(`Error reading file from disk: ${err}`);
    } else {
        const sites = JSON.parse(data);

        let index = 0;
        let childProcess = null;

        function runCommand() {
            if (childProcess) {
                childProcess.kill(); // terminate the previous command
            }

            if (index >= sites.length) {
                console.log('All sites processed');
                return;
            }

            const site = 'https://search.brave.com/search?q=' + encodeURIComponent(sites[index]);
            console.log(`Processing site: ${site}`); // Output the current site
            childProcess = spawn('node', ['web.js', site]);

            childProcess.stdout.on('data', (data) => {
                // console.log(`stdout: ${data}`);
            });

            childProcess.stderr.on('data', (data) => {
                // console.log(`stderr: ${data}`);
            });

            childProcess.on('error', (error) => {
                console.log(`error: ${error.message}`);
            });

            index++;
            setTimeout(runCommand, 30000); // wait for 30 seconds before running the next command
        }

        runCommand();
    }
});