import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import Tesseract from 'tesseract.js';
import { Poppler } from "node-poppler";
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Converts a standard Google Drive sharing link into a direct download link.
 * @param {string} url The original Google Drive URL.
 * @returns {string} The direct download URL or the original URL.
 */
const getDirectGoogleDriveUrl = (url) => {
  const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
};

/**
 * Extracts text from a PDF, automatically using OCR for image-based documents.
 * This is the function your controllers will import and use.
 *
 * @param {string} pdfUrl - The public URL of the PDF file.
 * @returns {Promise<string>} A promise that resolves to the extracted text.
 */
export const extractTextFromPdf = async (pdfUrl) => {
  if (!pdfUrl || !pdfUrl.toLowerCase().startsWith('http')) {
    throw new Error('Invalid PDF URL provided. Must be an absolute web address.');
  }

  const directUrl = getDirectGoogleDriveUrl(pdfUrl);
  console.log(`Processing document from: ${directUrl}`);

  try {
    // Download the PDF data once. We'll use this buffer for both attempts.
    const response = await axios.get(directUrl, {
      responseType: 'arraybuffer'
    });
    const pdfData = new Uint8Array(response.data);

    // --- STEP 1: Attempt fast, standard text extraction first ---
    let fullText = '';
    try {
      // FIX: Use a slice of the data for pdf.js to prevent detaching the original buffer.
      // This creates a copy, so the original pdfData remains valid for the OCR step.
      const pdf = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
    } catch (pdfJsError) {
      console.warn('pdf.js failed, likely an image-based PDF. Proceeding with OCR.');
      fullText = ''; // Ensure fullText is empty to trigger the OCR fallback
    }

    // --- STEP 2: Check if standard extraction was successful ---
    if (fullText.trim().length > 50) {
      console.log('Successfully extracted text using standard pdf.js method.');
      return fullText.replace(/\s+/g, ' ').trim();
    }

    // --- STEP 3: If standard extraction fails, fall back to OCR with a more robust method ---
    console.log('Standard extraction yielded no text. Falling back to OCR...');
    
    // Create a temporary directory to store intermediate files
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uniconnect-ocr-'));
    const tempPdfPath = path.join(tempDir, 'input.pdf');
    let ocrText = '';

    try {
        // 1. Write the PDF buffer to a temporary file for poppler to process
        await fs.writeFile(tempPdfPath, pdfData);
        console.log(`[OCR Step] Successfully wrote PDF to temporary path: ${tempPdfPath}`);


        // 2. Use Poppler to convert PDF pages to high-resolution PNG images
        const poppler = new Poppler();
        const outputFilePrefix = path.join(tempDir, 'page');
        
        console.log('[OCR Step] Starting PDF to PNG conversion with Poppler...');
        // FIX: Corrected the resolution options to use the command-line flags 'rx' and 'ry'
        await poppler.pdfToCairo(tempPdfPath, outputFilePrefix, { 
            pngFile: true, 
            rx: 300, // Corresponds to the -rx command-line option
            ry: 300  // Corresponds to the -ry command-line option
        });
        console.log('[OCR Step] PDF to PNG conversion completed.');

        
        // 3. Get the list of generated image files
        const files = await fs.readdir(tempDir);
        const imageFiles = files
            .filter(file => file.startsWith('page') && file.endsWith('.png'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            }); // Sort numerically to ensure correct page order

        console.log(`[OCR Step] Found ${imageFiles.length} image(s) to process:`, imageFiles);

        if (imageFiles.length === 0) {
            throw new Error('Poppler converted the PDF, but no PNG images were found.');
        }

        // 4. Loop through each page image and run Tesseract OCR
        for (const imageFile of imageFiles) {
            const imagePath = path.join(tempDir, imageFile);
            console.log(`[OCR Step] Performing OCR on ${imageFile}...`);
            const { data: { text } } = await Tesseract.recognize(
                imagePath,
                'eng',
                { logger: m => console.log(`[Tesseract: ${imageFile}] ${m.status} (${(m.progress * 100).toFixed(0)}%)`) }
            );
            ocrText += text + '\n';
        }

    } finally {
        // 5. IMPORTANT: Clean up the temporary directory and all its files
        console.log(`[OCR Step] Cleaning up temporary directory: ${tempDir}`);
        await fs.rm(tempDir, { recursive: true, force: true });
    }
    
    if (!ocrText.trim()) {
        throw new Error('OCR processing also failed. The document might be empty or unreadable.');
    }

    console.log('Successfully extracted text using Tesseract OCR.');
    return ocrText.replace(/\s+/g, ' ').trim();

  } catch (error) {
    console.error(`Fatal error during PDF processing for URL: ${directUrl}`, error.message);
    if (error.isAxiosError) {
      throw new Error('Failed to download the PDF. Check if the URL is correct and publicly accessible.');
    }
    // Re-throw the error to be caught by the controller
    throw error;
  }
};

