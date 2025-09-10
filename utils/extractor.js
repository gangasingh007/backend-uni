import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';

/**
 * Extracts text from a publicly accessible PDF, DOCX, or Google Docs document.
 * It automatically detects the source and handles the URL accordingly.
 *
 * @param {string} fileUrl - The public URL of the PDF, DOCX, or Google Doc.
 * @returns {Promise<string>} A promise that resolves to the extracted text.
 */
export const extractText = async (fileUrl) => {
  if (!fileUrl || !fileUrl.toLowerCase().startsWith('http')) {
    throw new Error('Invalid URL provided. Must be an absolute web address.');
  }

  let directUrl = fileUrl;
  let extension = '';

  // --- NEW LOGIC TO HANDLE DIFFERENT URL TYPES ---
  // 1. Check for a Google Docs URL
  const gdocsMatch = fileUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (gdocsMatch && gdocsMatch[1]) {
    const fileId = gdocsMatch[1];
    // Force export as a .docx file
    directUrl = `https://docs.google.com/document/d/${fileId}/export?format=docx`;
    extension = 'docx'; // Manually set the extension for the parser
  }
  // 2. Check for a Google Drive URL (for files uploaded to Drive)
  else {
    const gdriveMatch = fileUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdriveMatch && gdriveMatch[1]) {
      const fileId = gdriveMatch[1];
      directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      // For Drive, we still need to guess the extension from the original URL
      extension = new URL(fileUrl).pathname.split('.').pop().toLowerCase();
    }
    // 3. Handle a standard URL
    else {
      extension = new URL(fileUrl).pathname.split('.').pop().toLowerCase();
    }
  }
  // --- END OF NEW LOGIC ---

  try {
    // Download the file as a buffer
    const response = await axios.get(directUrl, {
      responseType: 'arraybuffer'
    });
    const fileDataBuffer = response.data;
    let fullText = '';

    // Route to the correct parser based on the determined extension
    if (extension === 'pdf') {
      const pdfData = new Uint8Array(fileDataBuffer);
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }

    } else if (extension === 'docx') {
      const result = await mammoth.extractRawText({ buffer: fileDataBuffer });
      fullText = result.value;

    } else {
      throw new Error(`Unsupported file type or extension not found for URL: ${fileUrl}`);
    }

    // Final cleanup and return
    if (!fullText.trim()) {
      throw new Error('Failed to extract readable text. The document might be empty or image-only.');
    }

    return fullText.replace(/\s+/g, ' ').trim();

  } catch (error) {
    console.error(`Processing failed for URL: ${directUrl}`, error.message);
    if (error.isAxiosError) {
      throw new Error('Failed to download the file. Check if the URL is correct and publicly accessible.');
    }
    throw new Error(`Failed to extract text from the document. ${error.message}`);
  }
};