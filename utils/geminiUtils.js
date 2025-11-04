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
        content: `${text}\n\n you are a great explainer and you have to Explain the above text in detail with easy-to-understand language with nice tablular comparisons and Exampels and mention the key points and important information in the text in a bullet point format`,
      },
    ],
    model: "llama-3.1-8b-instant", 
  });
}