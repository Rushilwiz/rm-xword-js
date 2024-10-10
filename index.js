import fs from 'fs';
import path from 'path'; // To work with file paths
import readline from 'readline';
import { exec } from 'child_process'; // To run the wget command
import { register, remarkable } from './node_modules/rmapi-js/dist/rmapi-js.esm.min.js';
import fetch from 'node-fetch'; // Only needed for Node.js < 18

global.fetch = fetch;

// Read the cookie and folder ID from the secrets.json file
const secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'));
const COOKIE = secrets.cookie; // Cookie for downloading the PDF
const XWORD_FOLDER_ID = secrets.xwordFolderId; // Folder ID for moving the file
const TOKEN_FILE = 'token.txt';
const PDF_DIR = 'pdfs'; // Current directory for downloading the PDF

// Function to get today's crossword PDF filename
function getTodaysPdfFilename() {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' }); // Get the 3-letter month
    const day = String(now.getDate()).padStart(2, '0'); // Get 2-digit day
    const year = String(now.getFullYear()).slice(-2); // Get last 2 digits of year
    return `${month}${day}${year}.pdf`; // Format: MMMDDYY.pdf
}

// Function to download the PDF using wget
function downloadPdf(pdfFilename) {
    return new Promise((resolve, reject) => {
        const url = `https://www.nytimes.com/svc/crosswords/v2/puzzle/print/${pdfFilename}`;
        const wgetCommand = `wget --no-verbose --content-disposition "${url}" \
          --header="Referer: https://www.nytimes.com/crosswords/archive/daily" \
          --header="Cookie: NYT-S=${COOKIE}" \
	 -P ${PDF_DIR}`; 
        exec(wgetCommand, (error, stdout, stderr) => {
            if (error) {
                reject(`Error downloading PDF: ${stderr}`);
            } else {
                console.log(`Downloaded ${pdfFilename}`);
                resolve(path.join(PDF_DIR, pdfFilename));
            }
        });
    });
}

// Function to get user input
function getUserInput(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (input) => {
            rl.close();
            resolve(input);
        });
    });
}

async function uploadTodaysPdf() {
    let token;
    if (fs.existsSync(TOKEN_FILE)) {
        // Read token from file
        token = fs.readFileSync(TOKEN_FILE, 'utf8');
    } else {
        // Prompt user for the code
        const code = await getUserInput('Enter the eight-letter code from https://my.remarkable.com/device/desktop/connect: ');
        token = await register(code);
        fs.writeFileSync(TOKEN_FILE, token); // Save token to file
    }

    try {
        const api = await remarkable(token);

        // Generate today's PDF filename
        const pdfFilename = getTodaysPdfFilename();
        
        // Download the PDF
        const pdfPath = await downloadPdf(pdfFilename);
        
        // Read the PDF file as a buffer
        const pdfBuffer = fs.readFileSync(pdfPath);

        // Upload the PDF to reMarkable
        
	const dayOfWeek = new Date().toLocaleString('en-US', { weekday: 'short' }); // Get the 3-letter day of the week
	const newFilename = `${pdfFilename.replace('.pdf', '')}${dayOfWeek}`; // Append the day of the week without the .pdf extension
	const uploadResult = await api.uploadPdf(newFilename, pdfBuffer);

	console.log('PDF upload successful:', uploadResult);
 
	const moveResult = await api.move(uploadResult.hash, XWORD_FOLDER_ID);
        console.log(`Moved ${newFilename} to folder with ID: ${XWORD_FOLDER_ID}`);

    } catch (error) {
        console.error('Error uploading PDF:', error);
    }
}

uploadTodaysPdf();

