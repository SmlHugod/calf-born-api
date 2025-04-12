const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Database setup
const dbPath = path.resolve(__dirname, "database/database.sqlite");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    process.exit(1);
  } else {
    console.log("Successfully connected to the database.");
    // Enable foreign key support
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
      if (pragmaErr) {
        console.error("Failed to enable foreign keys:", pragmaErr.message);
      }
    });
  }
});

app.use(express.json({ limit: "1000mb" })); // Use express built-in JSON parser, increase limit if needed

// Sync endpoint
app.put("/sync", (req, res) => {
  const campaigns = req.body;

  // Basic validation: Check if the body is an array
  if (!Array.isArray(campaigns)) {
    return res.status(400).json({
      message: "Invalid request body: Expected an array of campaigns.",
    });
  }

  // Begin transaction
  db.serialize(() => {
    db.run("BEGIN TRANSACTION;", (beginErr) => {
      if (beginErr) {
        console.error("Error beginning transaction:", beginErr.message);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      // Delete existing data (in reverse order of creation due to FKs)
      const deleteStmts = [
        "DELETE FROM Calves;",
        "DELETE FROM DeclarationBatches;",
        "DELETE FROM Campaigns;",
      ];

      let deleteError = null;
      db.exec(deleteStmts.join("\n"), (execErr) => {
        if (execErr) {
          deleteError = execErr;
          console.error("Error deleting existing data:", execErr.message);
          db.run("ROLLBACK;", (rollbackErr) => {
            if (rollbackErr)
              console.error("Rollback failed:", rollbackErr.message);
            return res
              .status(500)
              .json({ message: "Internal Server Error during data deletion" });
          });
          return; // Stop further execution in this callback
        }

        // If deletion was successful, proceed with insertion
        // Prepare insertion statements
        const insertCampaign = db.prepare(
          "INSERT INTO Campaigns (id, name, createdAt) VALUES (?, ?, ?)"
        );
        const insertCalf = db.prepare(
          "INSERT INTO Calves (id, campaignId, motherId, sexColor, calfId, notes, isDeclared, declarationBatchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        const insertBatch = db.prepare(
          "INSERT INTO DeclarationBatches (id, campaignId, declaredAt) VALUES (?, ?, ?)"
        );

        let insertError = null;

        try {
          for (const campaign of campaigns) {
            // Basic validation for campaign structure (add more as needed)
            if (!campaign.id || !campaign.name || !campaign.createdAt) {
              throw new Error(
                `Invalid campaign structure: ${JSON.stringify(campaign)}`
              );
            }
            insertCampaign.run(campaign.id, campaign.name, campaign.createdAt);

            if (
              campaign.declarationBatches &&
              Array.isArray(campaign.declarationBatches)
            ) {
              for (const batch of campaign.declarationBatches) {
                if (!batch.id || !batch.declaredAt) {
                  throw new Error(
                    `Invalid declaration batch structure: ${JSON.stringify(
                      batch
                    )}`
                  );
                }
                insertBatch.run(batch.id, campaign.id, batch.declaredAt);
              }
            }

            if (campaign.calves && Array.isArray(campaign.calves)) {
              for (const calf of campaign.calves) {
                if (
                  calf.id === undefined ||
                  calf.motherId === undefined ||
                  calf.sexColor === undefined ||
                  calf.calfId === undefined ||
                  calf.isDeclared === undefined
                ) {
                  throw new Error(
                    `Invalid calf structure: ${JSON.stringify(calf)}`
                  );
                }
                const isDeclaredInt = calf.isDeclared ? 1 : 0;
                insertCalf.run(
                  calf.id,
                  campaign.id,
                  calf.motherId,
                  calf.sexColor,
                  calf.calfId,
                  calf.notes,
                  isDeclaredInt,
                  calf.declarationBatchId
                );
              }
            }
          }

          // Finalize statements
          insertCampaign.finalize();
          insertCalf.finalize();
          insertBatch.finalize();
        } catch (err) {
          insertError = err;
          console.error("Error during data insertion:", err.message);
          // Finalize statements even if error occurred during run
          insertCampaign.finalize();
          insertCalf.finalize();
          insertBatch.finalize();

          db.run("ROLLBACK;", (rollbackErr) => {
            if (rollbackErr)
              console.error("Rollback failed:", rollbackErr.message);
            // Determine appropriate status code (400 for validation errors, 500 for others)
            const statusCode = err.message.startsWith("Invalid") ? 400 : 500;
            const clientMessage =
              statusCode === 400
                ? err.message
                : "Internal Server Error during data insertion";
            return res.status(statusCode).json({ message: clientMessage });
          });
          return; // Stop further execution
        }

        // If no errors during insertion, commit the transaction
        if (!insertError) {
          db.run("COMMIT;", (commitErr) => {
            if (commitErr) {
              console.error("Error committing transaction:", commitErr.message);
              db.run("ROLLBACK;", (rollbackErr) => {
                if (rollbackErr)
                  console.error("Rollback failed:", rollbackErr.message);
                return res
                  .status(500)
                  .json({ message: "Internal Server Error during commit" });
              });
            } else {
              console.log("Sync successful, transaction committed.");
              res.status(200).json({ message: "Sync successful" });
            }
          });
        }
      });
    }); // End BEGIN TRANSACTION callback
  }); // End db.serialize
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Database connection closed.");
    process.exit(0);
  });
});
