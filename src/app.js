const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE bids (name TEXT, room1 INTEGER, room2 INTEGER, room3 INTEGER, room4 INTEGER, room5 INTEGER)");
    console.log("Database and table initialized.");
});

app.post('/submit-bids', (req, res) => {
    const { name, room1, room2, room3, room4, room5 } = req.body;

    console.log(`Received bid submission: ${JSON.stringify(req.body)}`);

    db.run(`INSERT INTO bids (name, room1, room2, room3, room4, room5) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            name, 
            parseInt(room1, 10) || 0, 
            parseInt(room2, 10) || 0, 
            parseInt(room3, 10) || 0, 
            parseInt(room4, 10) || 0, 
            parseInt(room5, 10) || 0
        ], 
        function (err) {
            if (err) {
                console.error("Failed to submit bids.", err);
                return res.status(500).send("Failed to submit bids.");
            }
            console.log(`Bids for ${name} submitted successfully.`);
            res.send("Bids submitted successfully.");
        });
});

app.get('/highest-bids', (req, res) => {
    db.all(`
        SELECT name, room1, room2, room3, room4, room5 FROM bids
    `, [], (err, rows) => {
        if (err) {
            console.error("Failed to retrieve bids.", err);
            return res.status(500).send("Failed to retrieve bids.");
        }

        let maxBids = {
            room1: 0,
            room2: 0,
            room3: 0,
            room4: 0,
            room5: 0,
        };

        rows.forEach(row => {
            maxBids.room1 = Math.max(maxBids.room1, row.room1);
            maxBids.room2 = Math.max(maxBids.room2, row.room2);
            maxBids.room3 = Math.max(maxBids.room3, row.room3);
            maxBids.room4 = Math.max(maxBids.room4, row.room4);
            maxBids.room5 = Math.max(maxBids.room5, row.room5);
        });

        res.json(maxBids);
    });
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

