import app from "./app";
import { startBot } from "./bot";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

startBot();
