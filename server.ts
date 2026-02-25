import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("agri.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS auctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    base_price REAL NOT NULL,
    current_price REAL NOT NULL,
    farmer_name TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auction_id INTEGER NOT NULL,
    bidder_name TEXT NOT NULL,
    bidder_type TEXT NOT NULL, -- 'wholesale' | 'store'
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auctions (id)
  );
`);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // API Routes
  app.get("/api/auctions", (req, res) => {
    const auctions = db.prepare("SELECT * FROM auctions WHERE status = 'active' ORDER BY created_at DESC").all();
    res.json(auctions);
  });

  app.post("/api/auctions", (req, res) => {
    const { crop_name, quantity, base_price, farmer_name, location } = req.body;
    const info = db.prepare(
      "INSERT INTO auctions (crop_name, quantity, base_price, current_price, farmer_name, location) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(crop_name, quantity, base_price, base_price, farmer_name, location);
    
    const newAuction = db.prepare("SELECT * FROM auctions WHERE id = ?").get(info.lastInsertRowid);
    
    // Broadcast new auction
    broadcast({ type: "NEW_AUCTION", auction: newAuction });
    
    res.json(newAuction);
  });

  app.post("/api/bids", (req, res) => {
    const { auction_id, bidder_name, bidder_type, amount } = req.body;
    
    const auction = db.prepare("SELECT * FROM auctions WHERE id = ?").get(auction_id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    if (amount <= auction.current_price) return res.status(400).json({ error: "Bid must be higher than current price" });

    db.transaction(() => {
      db.prepare("INSERT INTO bids (auction_id, bidder_name, bidder_type, amount) VALUES (?, ?, ?, ?)").run(
        auction_id, bidder_name, bidder_type, amount
      );
      db.prepare("UPDATE auctions SET current_price = ? WHERE id = ?").run(amount, auction_id);
    })();

    const updatedAuction = db.prepare("SELECT * FROM auctions WHERE id = ?").get(auction_id);
    
    // Broadcast new bid
    broadcast({ type: "NEW_BID", auction: updatedAuction });
    
    res.json(updatedAuction);
  });

  // WebSocket Logic
  function broadcast(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.on("close", () => console.log("Client disconnected"));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
