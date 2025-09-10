import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);  // Store API key in .env

export async function geminiSummarize(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = ` \n${text}\n\n Explain the above text and more content if need be to explain it in easy to understand Language`;

  const result = await model.generateContent(prompt);

  // Use `.response?.candidates[0]?.content?.parts[0]?.text` to get summary, or adjust based on Gemini response shape
  console.log(result?.response?.candidates?.[0]?.content?.parts?.[0]?.text);
  return result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
