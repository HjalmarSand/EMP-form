// Add this to your server.js (maybe temporarily for testing)
// or create a separate script (e.g., view_db.js)

const path = require('path'); // Make sure path is required if in a separate file

// Reuse the knex instance from server.js
// If in a separate file, you'd need to configure Knex again:
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, 'submissions.db')
  },
  useNullAsDefault: true
});

async function viewAllSubmissions() {
  try {
    console.log("Fetching submissions from database...");
    // Select specific columns or all (*)
    const submissions = await knex('submissions').select('id', 'name', 'email', 'age', 'timestamp');
    // const submissions = await knex('submissions').select('*'); // Selects all

    if (submissions.length === 0) {
      console.log("No submissions found in the database.");
    } else {
      console.log("--- Submissions ---");
      console.table(submissions); // console.table provides nice formatting
      console.log("-------------------");
    }

  } catch (error) {
    console.error("Error fetching submissions:", error);
  } finally {
    // Important: Destroy the Knex connection pool if this is a standalone script
    // or if you're done with it in your server temporarily.
    // Don't do this in your main server.js unless the server is shutting down.
     await knex.destroy();
     console.log("Database connection closed.");
  }
}

// Call the function
viewAllSubmissions();