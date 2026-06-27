import { Client, GuildMember, Message } from "discord.js";
import { logger } from "../lib/logger";
import { loadState, saveState, PendingVerification, State } from "./persistence";
import { buildNickname } from "./nickname";

const VERIFICATION_ROLE_ID = "1520094822256476445";
const TIMEOUT_MS = 60 * 60 * 1000;

const timeoutHandles = new Map<string, NodeJS.Timeout>();

let state: State;

export function initVerification(client: Client) {
  state = loadState();

  const now = Date.now();
  for (const [userId, pending] of Object.entries(state.pending)) {
    const remaining = pending.timeoutAt - now;
    if (remaining <= 0) {
      void kickUser(client, pending.guildId, userId);
    } else {
      scheduleKick(client, userId, pending.guildId, remaining);
    }
  }

  client.on("guildMemberAdd", (member) => {
    void handleMemberJoin(client, member as GuildMember);
  });

  client.on("messageCreate", (message) => {
    if (message.author.bot) return;
    if (!message.channel.isDMBased()) return;
    if (!state.pending[message.author.id]) return;
    void handleVerificationReply(client, message);
  });
}

async function handleMemberJoin(client: Client, member: GuildMember) {
  if (member.user.bot) return;

  const userId = member.user.id;
  const guildId = member.guild.id;
  const now = Date.now();

  const pending: PendingVerification = {
    guildId,
    userId,
    step: "gender",
    joinedAt: now,
    timeoutAt: now + TIMEOUT_MS,
  };

  state.pending[userId] = pending;
  saveState(state);

  try {
    await member.user.send(
      "👋 Welcome to the server! To get access, please answer two quick questions.\n\n" +
      "**Question 1 of 2:** What is your gender?\n" +
      "Reply with **M** for Male or **F** for Female.\n\n" +
      "⏰ You have **1 hour** to complete verification or you will be removed from the server."
    );
  } catch (err) {
    logger.error({ err, userId }, "Could not DM new member for verification");
  }

  scheduleKick(client, userId, guildId, TIMEOUT_MS);
  logger.info({ userId, guildId }, "Verification started for new member");
}

async function handleVerificationReply(client: Client, message: Message) {
  const userId = message.author.id;
  const pending = state.pending[userId];
  if (!pending) return;

  const reply = message.content.trim().toUpperCase();

  if (pending.step === "gender") {
    if (reply !== "M" && reply !== "F") {
      await message.reply("❌ Invalid response. Please reply with **M** for Male or **F** for Female.");
      return;
    }

    pending.gender = reply as "M" | "F";
    pending.step = "birthYear";
    state.pending[userId] = pending;
    saveState(state);

    await message.reply(
      "✅ Got it!\n\n" +
      "**Question 2 of 2:** What is your birth year?\n" +
      "Reply with just the year. Example: **2007**"
    );
  } else if (pending.step === "birthYear") {
    const year = parseInt(reply, 10);
    const currentYear = new Date().getFullYear();

    if (isNaN(year) || year < 1900 || year > currentYear) {
      await message.reply(`❌ Invalid year. Please reply with a valid birth year (Example: **2007**).`);
      return;
    }

    await completeVerification(client, userId, pending, year);
  }
}

async function completeVerification(
  client: Client,
  userId: string,
  pending: PendingVerification,
  birthYear: number
) {
  const gender = pending.gender!;
  const joinCode = (new Date().getFullYear() % 100).toString();

  if (!state.serials[joinCode]) state.serials[joinCode] = 0;
  state.serials[joinCode] += 1;
  const serial = state.serials[joinCode];

  const nickname = buildNickname(gender, birthYear, joinCode, serial);

  delete state.pending[userId];
  saveState(state);

  const handle = timeoutHandles.get(userId);
  if (handle) {
    clearTimeout(handle);
    timeoutHandles.delete(userId);
  }

  try {
    const guild = await client.guilds.fetch(pending.guildId);
    const member = await guild.members.fetch(userId);

    await member.setNickname(nickname);
    await member.roles.add(VERIFICATION_ROLE_ID);

    await member.user.send(
      `✅ **Verification complete!**\n\n` +
      `Your nickname has been set to **${nickname}** and you now have full access to the server.\n\n` +
      `Welcome! 🎉`
    );

    logger.info({ userId, nickname }, "Member verified successfully");
  } catch (err) {
    logger.error({ err, userId }, "Failed to complete verification for member");
  }
}

function scheduleKick(client: Client, userId: string, guildId: string, delayMs: number) {
  const handle = setTimeout(() => {
    void kickUser(client, guildId, userId);
  }, delayMs);
  timeoutHandles.set(userId, handle);
}

async function kickUser(client: Client, guildId: string, userId: string) {
  if (!state.pending[userId]) return;

  delete state.pending[userId];
  saveState(state);
  timeoutHandles.delete(userId);

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    try {
      await member.user.send(
        "⏰ You did not complete verification within 24 hours and have been removed from the server.\n" +
        "You are welcome to rejoin and try again!"
      );
    } catch {
      // User has DMs disabled — that's fine, still kick
    }

    await member.kick("Did not complete verification within 24 hours");
    logger.info({ userId, guildId }, "Kicked unverified member after timeout");
  } catch (err) {
    logger.error({ err, userId }, "Failed to kick unverified member");
  }
}
