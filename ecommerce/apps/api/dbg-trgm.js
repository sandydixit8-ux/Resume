const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const env = Object.fromEntries(
  fs.readFileSync("C:/Users/Ats/OneDrive/Documents/Default Project/ecommerce/apps/api/.env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
process.env.DATABASE_URL = env.DATABASE_URL;

const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        word_similarity('nexsu', 'nexus air 5g') AS ws_ne,
        strict_word_similarity('nexsu', 'nexus air 5g') AS sws_ne,
        word_similarity('airs', 'nexus air 5g') AS ws_airs,
        word_similarity('soundcore', 'soundcore pro buds') AS ws_sc,
        word_similarity('soundcr', 'soundcore pro buds') AS ws_sc2,
        word_similarity('buds', 'soundcore pro buds') AS ws_buds;
    `;
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error("SQL ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();