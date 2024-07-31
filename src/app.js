const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3001;
const adminPassword = "password"; // Set your admin password here

app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database(':memory:');
let roomAssignments = []; // To store room assignments

db.serialize(() => {
    db.run("CREATE TABLE bids (name TEXT, room1 INTEGER, room2 INTEGER, room3 INTEGER, room4 INTEGER, room5 INTEGER)");
    console.log("Database and table initialized.");
});

// Calculate the max total bid and the optimal room arrangement
function calculateOptimalArrangement(rows) {
    let maxBid = 0;
    let optimalAssignment = [];
    const bidders = rows.map(row => ({
        name: row.name,
        bids: [row.room1, row.room2, row.room3, row.room4, row.room5]
    }));

    function* generatePermutations(arr, n = arr.length) {
        if (n <= 1) yield arr.slice();
        else for (let i = 0; i < n; i++) {
            yield* generatePermutations(arr, n - 1);
            const j = n % 2 ? 0 : i;
            [arr[n - 1], arr[j]] = [arr[j], arr[n - 1]];
        }
    }

    for (const perm of generatePermutations([0, 1, 2, 3, 4])) {
        let currentBid = 0;
        const currentAssignment = [];
        const assignedBidders = new Set();

        perm.forEach((room, index) => {
            let highestBid = 0;
            let selectedBidder = null;

            bidders.forEach(bidder => {
                if (!assignedBidders.has(bidder.name) && bidder.bids[room] > highestBid) {
                    highestBid = bidder.bids[room];
                    selectedBidder = bidder.name;
                }
            });

            if (selectedBidder) {
                assignedBidders.add(selectedBidder);
                currentBid += highestBid;
                currentAssignment.push({ name: selectedBidder, room: `Room ${room + 1}`, bid: highestBid });
            }
        });

        if (currentBid > maxBid) {
            maxBid = currentBid;
            optimalAssignment = currentAssignment;
        }
    }

    return { maxBid, optimalAssignment };
}

app.post('/submit-bids', (req, res) => {
    const { name, room1, room2, room3, room4, room5 } = req.body;

    db.run(`INSERT INTO bids (name, room1, room2, room3, room4, room5) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, parseInt(room1, 10) || 0, parseInt(room2, 10) || 0, parseInt(room3, 10) || 0, parseInt(room4, 10) || 0, parseInt(room5, 10) || 0], 
        function (err) {
            if (err) {
                console.error("Failed to submit bids.", err);
                return res.status(500).send("Failed to submit bids.");
            }
            db.all(`SELECT name, room1, room2, room3, room4, room5 FROM bids`, [], (err, rows) => {
                if (err) {
                    console.error("Failed to retrieve bids.", err);
                    return res.status(500).send("Failed to retrieve bids.");
                }

                const { maxBid, optimalAssignment } = calculateOptimalArrangement(rows);
                roomAssignments.unshift({ time: new Date().toISOString(), maxBid, assignment: optimalAssignment });
                
                // Send a response to the client to refresh the highest bids and max total bid
                res.send("Bids submitted successfully.");
            });
        });
});


app.get('/highest-bids', (req, res) => {
    db.all(`SELECT room1, room2, room3, room4, room5 FROM bids`, [], (err, rows) => {
        if (err) {
            console.error("Failed to retrieve bids.", err);
            return res.status(500).send("Failed to retrieve bids.");
        }

        const highestBids = {
            room1: 0,
            room2: 0,
            room3: 0,
            room4: 0,
            room5: 0
        };

        rows.forEach(row => {
            highestBids.room1 = Math.max(highestBids.room1, row.room1);
            highestBids.room2 = Math.max(highestBids.room2, row.room2);
            highestBids.room3 = Math.max(highestBids.room3, row.room3);
            highestBids.room4 = Math.max(highestBids.room4, row.room4);
            highestBids.room5 = Math.max(highestBids.room5, row.room5);
        });

        res.json(highestBids);
    });
});

app.get('/admin', (req, res) => {
    const password = req.query.password;
    if (password !== adminPassword) {
        return res.status(401).send("Unauthorized");
    }

    let tableContent = roomAssignments.map(assignment => {
        return `
            <tr>
                <td>${new Date(assignment.time).toLocaleString()}</td>
                <td>${assignment.assignment.map(a => `${a.name}`).join(', ')}</td>
                <td>${assignment.assignment.map(a => `${a.room}`).join(', ')}</td>
                <td>${assignment.assignment.map(a => `$${a.bid}`).join(', ')}</td>
                <td>$${assignment.maxBid}</td>
            </tr>`;
    }).join('');

    res.send(`
        <html>
        <head>
            <title>Admin - Room Assignments</title>
        </head>
        <body>
            <h1>Room Assignments</h1>
            <table border="1">
                <thead>
                    <tr>
                        <th>Submission Time</th>
                        <th>Names</th>
                        <th>Rooms</th>
                        <th>Bids</th>
                        <th>Max Bid</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableContent}
                </tbody>
            </table>
        </body>
        </html>
    `);
});

app.get('/max-total-bid', (req, res) => {
    db.all(`SELECT name, room1, room2, room3, room4, room5 FROM bids`, [], (err, rows) => {
        if (err) {
            console.error("Failed to retrieve bids.", err);
            return res.status(500).send("Failed to retrieve bids.");
        }

        const { maxBid } = calculateOptimalArrangement(rows);
        res.json({ maxTotalBid: maxBid });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
