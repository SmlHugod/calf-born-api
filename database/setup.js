const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Define the path to the database file
const dbPath = path.resolve(__dirname, "database.sqlite");

// Connect to the SQLite database (or create it if it doesn't exist)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log(`Connected to the SQLite database at ${dbPath}`);
});

// SQL statements to create tables
const createCampaignsTable = `
CREATE TABLE IF NOT EXISTS Campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
);`;

const createCalvesTable = `
CREATE TABLE IF NOT EXISTS Calves (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    motherId TEXT NOT NULL,
    sexColor TEXT NOT NULL CHECK(sexColor IN ('FB', 'MB', 'FJ', 'MJ')),
    calfId TEXT NOT NULL,
    notes TEXT,
    isDeclared INTEGER NOT NULL DEFAULT 0,
    declarationBatchId TEXT,
    FOREIGN KEY (campaignId) REFERENCES Campaigns (id) ON DELETE CASCADE,
    FOREIGN KEY (declarationBatchId) REFERENCES DeclarationBatches (id) ON DELETE SET NULL
);`;
// Added ON DELETE CASCADE for campaignId and ON DELETE SET NULL for declarationBatchId for better relational integrity

const createDeclarationBatchesTable = `
CREATE TABLE IF NOT EXISTS DeclarationBatches (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    declaredAt TEXT NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES Campaigns (id) ON DELETE CASCADE
);`;
// Added ON DELETE CASCADE for campaignId

// Execute table creation sequentially
db.serialize(() => {
  db.run(createCampaignsTable, (err) => {
    if (err) {
      console.error("Error creating Campaigns table:", err.message);
    } else {
      console.log("Campaigns table created or already exists.");
    }
  });

  db.run(createDeclarationBatchesTable, (err) => {
    if (err) {
      console.error("Error creating DeclarationBatches table:", err.message);
    } else {
      console.log("DeclarationBatches table created or already exists.");
    }
  });

  db.run(createCalvesTable, (err) => {
    if (err) {
      console.error("Error creating Calves table:", err.message);
    } else {
      console.log("Calves table created or already exists.");
    }
  });
});

// Close the database connection
db.close((err) => {
  if (err) {
    console.error("Error closing database:", err.message);
  } else {
    console.log("Database connection closed.");
    console.log("Database setup complete.");
  }
});
