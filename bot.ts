import {
  Client,
  GatewayIntentBits,
  TextChannel,
  AttachmentBuilder,
  Partials,
} from "discord.js";
import cron from "node-cron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./lib/logger";
import { initVerification } from "./bot/verification";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function sendScheduledMessage(
  client: Client,
  channelId: string,
  content: string,
  audioFile: string
) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    logger.error({ channelId }, "Channel not found or is not a text channel");
    return;
  }

  const audioPath = path.resolve(__dirname, "../assets", audioFile);
  const attachment = new AttachmentBuilder(audioPath, { name: audioFile });

  await channel.send({ content, files: [attachment] });
}

export function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  const channelId = process.env["DISCORD_CHANNEL_ID"];

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN environment variable is required but was not provided.");
  }
  if (!channelId) {
    throw new Error("DISCORD_CHANNEL_ID environment variable is required but was not provided.");
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,   // Privileged — enable in Discord Developer Portal
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent, // Privileged — enable in Discord Developer Portal
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once("clientReady", () => {
    logger.info({ tag: client.user?.tag }, "Discord bot logged in");

    // Initialise verification system
    initVerification(client);

    // 8:00 AM IST = 02:30 UTC
    cron.schedule(
      "30 2 * * *",
      async () => {
        try {
          await sendScheduledMessage(
            client,
            channelId,
            "@everyone 🌞 Good morning everyone!",
            "good_morning.mp3"
          );
          logger.info({ channelId }, "Good morning message sent");
        } catch (err) {
          logger.error({ err }, "Failed to send good morning message");
        }
      },
      { timezone: "UTC" }
    );

    // 10:00 PM IST = 16:30 UTC
    cron.schedule(
      "30 16 * * *",
      async () => {
        try {
          await sendScheduledMessage(
            client,
            channelId,
            "🌙 @everyone Good night everyone! Rest well and recharge for tomorrow! 😴✨",
            "good_night.mp3"
          );
          logger.info({ channelId }, "Good night message sent");
        } catch (err) {
          logger.error({ err }, "Failed to send good night message");
        }
      },
      { timezone: "UTC" }
    );

    logger.info("Schedulers started — Morning: 08:00 IST (02:30 UTC) | Night: 22:00 IST (16:30 UTC)");
  });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to log in to Discord");
    process.exit(1);
  });
}
