// Run this ONCE after deploying to register all slash commands
// node register.js

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Set DISCORD_TOKEN and CLIENT_ID as env variables first!");
  process.exit(1);
}

const usernameOption = {
  name: "username",
  description: "Roblox username",
  type: 3,
  required: true,
};

const commands = [
  {
    name: "altcheck",
    description: "🔍 Detect if a Roblox account is likely an alt",
    options: [usernameOption],
  },
  {
    name: "trust",
    description: "🤝 Get a trading trust score for a Roblox account",
    options: [usernameOption],
  },
  {
    name: "safe",
    description: "🛡️ Safety check — is this person safe to play with?",
    options: [usernameOption],
  },
  {
    name: "worth",
    description: "💰 Estimate how much a Roblox account is worth",
    options: [usernameOption],
  },
  {
    name: "groups",
    description: "👥 Analyze someone's Roblox groups for suspicious activity",
    options: [usernameOption],
  },
  {
    name: "roast",
    description: "🔥 Roast a Roblox account based on their stats",
    options: [usernameOption],
  },
  {
    name: "growth",
    description: "📈 Snapshot an account and track what changed over time",
    options: [usernameOption],
  },
  {
    name: "report",
    description: "📋 Full intelligence report on a Roblox account",
    options: [usernameOption],
  },
  {
    name: "compare",
    description: "⚔️ Side-by-side battle between two Roblox accounts",
    options: [
      { name: "user1", description: "First Roblox username", type: 3, required: true },
      { name: "user2", description: "Second Roblox username", type: 3, required: true },
    ],
  },
];

fetch(`https://discord.com/api/v10/applications/${CLIENT_ID}/commands`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
})
  .then((r) => r.json())
  .then((data) => {
    if (Array.isArray(data)) {
      console.log(`✅ Registered ${data.length} commands successfully!`);
      data.forEach(c => console.log(`  /${c.name}`));
    } else {
      console.error("❌ Error:", JSON.stringify(data, null, 2));
    }
  });
