// import { GoogleGenerativeAI } from '@google/generative-ai';

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);  // Store API key in .env

// export async function geminiSummarize(text) {
//   const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

//   const prompt = ` \n${text}\n\n Explain the above text in easy to understand Language`;

//   const result = await model.generateContent(prompt);

//   // Use `.response?.candidates[0]?.content?.parts[0]?.text` to get summary, or adjust based on Gemini response shape
//   return result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
// }


import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function groqSummarize(text) {
  const chatCompletion = await getGroqChatCompletion(text);
  // Print the completion returned by the LLM.
  return chatCompletion.choices[0]?.message?.content || "";
}

export async function getGroqChatCompletion(text) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `${text}\n\nExplain the above text in easy-to-understand language.`,
      },
    ],
    // --- FIX: Changed the model to a chat-based LLM ---
    model: "llama-3.1-8b-instant", 
  });
}