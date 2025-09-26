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
        content: `${text}\n\nExplain the above text comprehensively in easy-to-understand language.`,
      },
    ],
    model: "llama-3.1-8b-instant", 
  });
}