import { suggestNewDish } from './src/services/aiService.ts';

async function test() {
  const suggestion = await suggestNewDish(["chicken", "rice"]);
  console.log("Suggestion:", JSON.stringify(suggestion));
}

test().catch(console.error);
