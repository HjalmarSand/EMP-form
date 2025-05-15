// export-to-excel.js
const path = require('path');
const ExcelJS = require('exceljs'); // This will be bundled by pkg

// --- Path Adjustments for PKG ---
const isPackaged = typeof process.pkg !== 'undefined';
const baseDir = isPackaged ? path.dirname(process.execPath) : __dirname;

console.log(`Exporter base directory: ${baseDir}`);
console.log(`Exporter running as packaged app? ${isPackaged}`);

// --- Database Setup ---
const knex = require('knex')({ // This will be bundled by pkg
  client: 'sqlite3', // This will be bundled by pkg
  connection: {
    filename: path.join(baseDir, 'submissions.db') // DB next to the exe
  },
  useNullAsDefault: true
});

async function exportSubmissionsToExcel() {
  console.log("Connecting to database...");
  try {
    console.log("Fetching submissions from the database...");
    const submissions = await knex('submissions').select('*');

    if (submissions.length === 0) {
      console.log("No submissions found in the database. Excel file will not be created.");
      await knex.destroy();
      return;
    }
    console.log(`Found ${submissions.length} submissions.`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Submissions');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Timestamp', key: 'timestamp', width: 25 }
    ];
    worksheet.addRows(submissions);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern:'solid',
        fgColor:{argb:'FFDDDDDD'}
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Output Excel file will be next to the executable
    const excelFilePath = path.join(baseDir, 'submissions_export.xlsx');
    await workbook.xlsx.writeFile(excelFilePath);
    console.log(`Data successfully exported to ${excelFilePath}`);
    console.log("You can close this window now."); // User-friendly message

  } catch (error) {
    console.error("Error exporting data to Excel:", error);
    // Provide a user-friendly error message if packaged
    if (isPackaged) {
        console.error("An error occurred. Please check the console output above.");
        console.log("Press Enter to close this window.");
        // Keep window open for user to read error
        process.stdin.resume();
        process.stdin.on('data', process.exit.bind(process, 1));
    }
  } finally {
    if (knex) {
      console.log("Closing database connection...");
      await knex.destroy();
    }
     // If not packaged, exit normally. If packaged and no error, exit after a short delay or message.
    if (!isPackaged || (isPackaged && !console.error.toString().includes("Error exporting data"))) {
        // If packaged and successful, or not packaged, exit.
        // The console.log "You can close this window now" gives the user time.
        // For immediate close: process.exit(0);
    }
  }
}

exportSubmissionsToExcel();