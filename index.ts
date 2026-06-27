import app from "./app";
import { startBot } from "./bot";

const PORT = Number(process.env.PORT) || 3000;

console.log("Index file started");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

try {
  console.log("Starting bot...");
  startBot();
  console.log("startBot() called");
} catch (err) {
  console.error("Bot crashed:", err);
}
