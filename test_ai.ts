import "dotenv/config";
import { categorizeWithAI } from "./server/services/ai.js";

async function test() {
  console.log("Key exists:", !!process.env.GEMINI_API_KEY);
  const result = await categorizeWithAI(
    "https://react.dev",
    "React",
    "The library for web and native user interfaces",
    "React is a library for building user interfaces."
  );
  console.log("Result:", result);
}

test();
