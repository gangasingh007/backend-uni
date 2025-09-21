import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';

export const extractText = async (fileUrl) => {
  if (!fileUrl || !fileUrl.toLowerCase().startsWith('http')) {
    throw new Error('Invalid URL provided. Must be an absolute web address.');
  }

  let directUrl = fileUrl;
  let isGoogleDrive = false; // Flag to check if we need to inspect headers

  const gdocsMatch = fileUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  const gdriveMatch = fileUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);

  if (gdocsMatch && gdocsMatch[1]) {
    const fileId = gdocsMatch[1];
    directUrl = `https://docs.google.com/document/d/${fileId}/export?format=docx`;
  } else if (gdriveMatch && gdriveMatch[1]) {
    const fileId = gdriveMatch[1];
    directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    isGoogleDrive = true; // Mark this as a GDrive link
  }

  try {
    const response = await axios.get(directUrl, {
      responseType: 'arraybuffer'
    });
    
    let extension;

    // --- NEW LOGIC: Determine extension after download ---
    if (isGoogleDrive) {
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        // Extracts filename from the header, e.g., "filename=\"My Report.pdf\""
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          const filename = filenameMatch[1].replace(/['"]/g, '');
          extension = filename.split('.').pop().toLowerCase();
        }
      }
    } else if (gdocsMatch) {
        extension = 'docx'; // Google Docs are exported as docx
    } else {
      // For direct URLs, get extension from the path
      extension = new URL(fileUrl).pathname.split('.').pop().toLowerCase();
    }
    
    if (!extension) {
        throw new Error(`Could not determine file type for URL: ${fileUrl}`);
    }
    // --- END OF NEW LOGIC ---

    const fileDataBuffer = response.data;
    let fullText = '';

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
      throw new Error(`Unsupported file type: .${extension}`);
    }

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