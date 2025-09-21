import axios from "axios";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import unzipper from "unzipper";
import { parseStringPromise } from "xml2js";

export const extractText = async (fileUrl) => {
  if (!fileUrl || !fileUrl.toLowerCase().startsWith("http")) {
    throw new Error("Invalid URL provided. Must be an absolute web address.");
  }

  let directUrl = fileUrl;
  let isGoogleDrive = false;
  let extension;

  // --- Match different Google file types ---
  const gdocsMatch = fileUrl.match(
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/
  );
  const gslidesMatch = fileUrl.match(
    /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/
  );
  const gdriveMatch = fileUrl.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (gdocsMatch && gdocsMatch[1]) {
    // Google Docs → export as docx
    const fileId = gdocsMatch[1];
    directUrl = `https://docs.google.com/document/d/${fileId}/export?format=docx`;
    extension = "docx";
  } else if (gslidesMatch && gslidesMatch[1]) {
    // Google Slides → export as pptx
    const fileId = gslidesMatch[1];
    directUrl = `https://docs.google.com/presentation/d/${fileId}/export/pptx`;
    extension = "pptx";
  } else if (gdriveMatch && gdriveMatch[1]) {
    // Google Drive direct file
    const fileId = gdriveMatch[1];
    directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    isGoogleDrive = true;
  }

  try {
    const response = await axios.get(directUrl, {
      responseType: "arraybuffer",
    });

    // --- Determine extension if not already known ---
    if (!extension) {
      if (isGoogleDrive) {
        const contentDisposition = response.headers["content-disposition"];
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
          );
          if (filenameMatch && filenameMatch[1]) {
            const filename = filenameMatch[1].replace(/['"]/g, "");
            extension = filename.split(".").pop().toLowerCase();
          }
        }
      } else {
        extension = new URL(fileUrl).pathname.split(".").pop().toLowerCase();
      }
    }

    if (!extension) {
      throw new Error(`Could not determine file type for URL: ${fileUrl}`);
    }

    const fileDataBuffer = response.data;
    let fullText = "";

    // --- File type handling ---
    if (extension === "pdf") {
      // ✅ PDF
      const pdfData = new Uint8Array(fileDataBuffer);
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => item.str).join(" ") + "\n";
      }
    } else if (extension === "docx") {
      // ✅ DOCX
      const result = await mammoth.extractRawText({ buffer: fileDataBuffer });
      fullText = result.value;
    } else if (extension === "pptx") {
      // ✅ PPTX (manual unzip + XML parse)
      const directory = await unzipper.Open.buffer(fileDataBuffer);

      const slideFiles = directory.files.filter((f) =>
        f.path.startsWith("ppt/slides/slide")
      );

      const slidesText = [];

      for (const slideFile of slideFiles) {
        const content = await slideFile.buffer();
        const xml = await parseStringPromise(content.toString());
        const texts = [];

        // Recursively collect <a:t> text nodes
        const collectText = (obj) => {
          if (typeof obj === "object") {
            for (const key in obj) {
              if (key === "a:t" && Array.isArray(obj[key])) {
                texts.push(obj[key].join(" "));
              }
              collectText(obj[key]);
            }
          }
        };

        collectText(xml);
        slidesText.push(texts.join(" "));
      }

      fullText = slidesText
        .map((t, i) => `Slide ${i + 1}: ${t}`)
        .join("\n\n");
    } else {
      throw new Error(`Unsupported file type: .${extension}`);
    }

    if (!fullText.trim()) {
      throw new Error(
        "Failed to extract readable text. The document might be empty or image-only."
      );
    }

    return fullText.replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error(`Processing failed for URL: ${directUrl}`, error.message);
    if (error.isAxiosError) {
      throw new Error(
        "Failed to download the file. Check if the URL is correct and publicly accessible."
      );
    }
    throw new Error(
      `Failed to extract text from the document. ${error.message}`
    );
  }
};
