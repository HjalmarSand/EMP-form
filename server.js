// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// --- Path Adjustments for PKG ---
// Check if the app is running as a packaged executable
const isPackaged = typeof process.pkg !== 'undefined';

// baseDir will be the directory of the executable if packaged, otherwise the project root
const baseDir = isPackaged ? path.dirname(process.execPath) : __dirname;

console.log(`Application base directory: ${baseDir}`);
console.log(`Running as packaged app? ${isPackaged}`);

// --- Database Setup ---
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join(baseDir, 'submissions.db')
  },
  useNullAsDefault: true
});

const app = express();
const port = 3000;

// --- Sökvägar ---
const publicDir = path.join(baseDir, 'public');
const authFile = path.join(publicDir, 'auth.json'); // Path to auth file

console.log(`Serving static files from: ${publicDir}`);
console.log(`Using auth file: ${authFile}`);
console.log(`Using database file: ${path.join(baseDir, 'submissions.db')}`);

// --- Database Schema Setup ---
async function setupDatabase() {
  try {
    const exists = await knex.schema.hasTable('submissions');
    if (!exists) {
      console.log("Creating 'submissions' table...");
      await knex.schema.createTable('submissions', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.integer('age').notNullable();
        table.string('email').notNullable().unique(); // Email is still unique in the DB
        table.timestamp('timestamp').defaultTo(knex.fn.now());
      });
      console.log("Table 'submissions' created successfully.");
    } else {
      console.log("Table 'submissions' already exists.");
    }
  } catch (error) {
    console.error("Error setting up database schema:", error);
    process.exit(1);
  }
}

// --- File Handling Helpers (for auth.json) ---

/**
 * Reads the auth.json file.
 * Returns an empty array if the file doesn't exist.
 * @param {string} filePath Path to the file
 * @returns {Promise<string[]>} Parsed JSON data (array of emails)
 * @throws {Error} If the file cannot be read or parsed (except 'file not found')
 */
async function readAuthFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data); // Should be an array
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Auth file ${filePath} not found. Returning empty array.`);
      return []; // Return empty array if auth file doesn't exist
    }
    console.error(`Error reading/parsing ${filePath}:`, error);
    throw new Error(`Could not read data from ${filePath}`);
  }
}

/**
 * Writes data to the auth.json file.
 * @param {string} filePath Path to the file
 * @param {string[]} data Data to write (array of emails)
 * @throws {Error} If the file cannot be written
 */
async function writeAuthFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    throw new Error(`Could not write data to ${filePath}`);
  }
}

// --- Middleware ---
app.use(express.json());
app.use(express.static(publicDir));

// --- Routes ---
app.post('/submit', async (req, res) => {
  const { name, age, email } = req.body;

  console.log('Received request body for /submit:', req.body);

  if (!name || !age || !email) {
    return res.status(400).json({ message: "Missing required fields (name, age, email)." });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    // 1. Read auth.json
    let authorizedEmails = await readAuthFile(authFile); // Expecting an array

    // 2. Check if the email is in the authorized list
    const emailIndex = authorizedEmails.indexOf(normalizedEmail);

    if (emailIndex === -1) {
      // Email not found in the list (either never authorized or already used and removed)
      console.warn(`Attempt to submit form with unauthorized or already used email: ${normalizedEmail}`);
      return res.status(403).json({ message: "Email address is not authorized or has already been used." });
    }

    // --- Email is valid and authorized, proceed with saving ---

    // 3. Prepare the new submission data for the database
    const newSubmission = {
      name: name,
      age: age,
      email: normalizedEmail,
    };
    console.log('Data prepared for database:', newSubmission);

    // 4. Remove the email from the authorized list (in memory)
    authorizedEmails.splice(emailIndex, 1);

    // 5. Perform database insert AND update auth.json file
    await Promise.all([
      knex('submissions').insert(newSubmission),
      writeAuthFile(authFile, authorizedEmails) // Write the updated array back
    ]);

    // 6. Send success response
    console.log(`Submission saved for ${normalizedEmail}. Email removed from auth list.`);
    res.status(200).json({ message: "Submission saved and email removed from authorization list." });

  } catch (error) {
    console.error('Server error processing /submit:', error);
    if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed: submissions.email')) {
        console.warn(`Database constraint prevented duplicate email entry: ${normalizedEmail}`);
        // This is a fallback, ideally the auth.json logic prevents this.
        // If this happens, auth.json might be out of sync (email removed but DB insert failed).
        // For a more robust solution, consider a transaction or a retry mechanism for writing auth.json if DB fails.
        return res.status(409).json({ message: "Conflict: This email address appears to have been submitted already (database constraint)." });
    }
    res.status(500).json({ message: "Internal server error processing your request." });
  }
});

// --- Start server after ensuring DB is set up ---
async function startServer() {
  await setupDatabase();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Serving static files from: ${publicDir}`);
    console.log(`Using auth file: ${authFile}`);
    console.log(`Using database file: ${path.join(__dirname, 'submissions.db')}`);
    fs.access(authFile)
      .then(() => console.log(`Auth file ${authFile} found.`))
      .catch(() => console.warn(`WARNING: auth.json not found in ${publicDir}. Create it as an array of authorized emails.`));
  });
}

startServer();