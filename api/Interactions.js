import { verifyKey } from "discord-interactions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROBLOX = "https://users.roblox.com";
const FRIENDS = "https://friends.roblox.com";
const BADGES = "https://badges.roblox.com";
const GROUPS = "https://groups.roblox.com";
const PRESENCE = "https://presence.roblox.com";
const THUMBNAILS = "https://thumbnails.roblox.com";

async function robloxGet(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

async function getUserByUsername(username) {
  const r = await fetch(`${ROBLOX}/v1/usernames/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const d = await r.json();
  return d.data?.[0] ?? null;
}

async function getUserById(id) {
  return robloxGet(`${ROBLOX}/v1/users/${id}`);
}

async function getFriendsCount(id) {
  const d = await robloxGet(`${FRIENDS}/v1/users/${id}/friends/count`);
  return d?.count ?? 0;
}

async function getFollowersCount(id) {
  const d = await robloxGet(`${FRIENDS}/v1/users/${id}/followers/count`);
  return d?.count ?? 0;
}

async function getBadges(id) {
  const d = await robloxGet(`${BADGES}/v1/users/${id}/badges?limit=100&sortOrder=Asc`);
  return d?.data ?? [];
}

async function getGroups(id) {
  const d = await robloxGet(`${GROUPS}/v1/users/${id}/groups/roles`);
  return d?.data ?? [];
}

async function getPresence(id) {
  const r = await fetch(`${PRESENCE}/v1/presence/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: [id] }),
  });
  const d = await r.json();
  return d?.userPresences?.[0] ?? null;
}

async function getAvatar(id) {
  const d = await robloxGet(
    `${THUMBNAILS}/v1/users/avatar?userIds=${id}&size=420x420&format=Png`
  );
  return d?.data?.[0]?.imageUrl ?? null;
}

async function getHeadshot(id) {
  const d = await robloxGet(
    `${THUMBNAILS}/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png`
  );
  return d?.data?.[0]?.imageUrl ?? null;
}

function accountAgeInDays(created) {
  return Math.floor((Date.now() - new Date(created).getTime()) / 86400000);
}

function formatAge(days) {
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

const PRESENCE_LABEL = { 0: "Offline", 1: "Online", 2: "In Game 🎮", 3: "In Studio 🛠️" };
const PRESENCE_EMOJI = { 0: "⚫", 1: "🟢", 2: "🔵", 3: "🟠" };

// ─── Scoring algorithms ───────────────────────────────────────────────────────
function calcAltScore(ageDays, badges, friends, groups) {
  let score = 0;
  if (ageDays < 30) score += 40;
  else if (ageDays < 90) score += 20;
  else if (ageDays < 365) score += 10;

  if (badges < 5) score += 25;
  else if (badges < 20) score += 10;

  if (friends < 5) score += 20;
  else if (friends < 20) score += 10;

  if (groups < 2) score += 15;

  return Math.min(score, 99);
}

function calcTrustScore(ageDays, badges, friends, groups, followers) {
  let score = 0;
  score += Math.min(ageDays / 10, 30);
  score += Math.min(badges * 0.3, 20);
  score += Math.min(friends * 0.5, 20);
  score += Math.min(groups * 1.5, 15);
  score += Math.min(followers / 100, 15);
  return Math.min(Math.round(score), 100);
}

function calcWorth(ageDays, badges, friends, groups, followers) {
  let robux = 0;
  robux += ageDays * 2;
  robux += badges * 15;
  robux += friends * 10;
  robux += groups * 50;
  robux += followers * 5;
  return Math.round(robux);
}

function altVerdict(score) {
  if (score >= 70) return { label: "🚨 Very Likely Alt", color: 0xff2222 };
  if (score >= 45) return { label: "⚠️ Suspicious", color: 0xff9900 };
  if (score >= 20) return { label: "🤔 Possibly Alt", color: 0xffdd00 };
  return { label: "✅ Likely Legit", color: 0x00cc66 };
}

function trustVerdict(score) {
  if (score >= 75) return { label: "✅ Highly Trustworthy", color: 0x00cc66 };
  if (score >= 50) return { label: "🟡 Moderately Trustworthy", color: 0xffdd00 };
  if (score >= 25) return { label: "⚠️ Low Trust", color: 0xff9900 };
  return { label: "🚨 Do Not Trade", color: 0xff2222 };
}

function safetyVerdict(altScore, trustScore, susGroups) {
  if (altScore >= 70 || trustScore < 25 || susGroups > 2)
    return { label: "🚨 Not Safe", color: 0xff2222 };
  if (altScore >= 45 || trustScore < 50 || susGroups > 0)
    return { label: "⚠️ Proceed with Caution", color: 0xff9900 };
  return { label: "✅ Safe to Play With", color: 0x00cc66 };
}

const SUSPICIOUS_KEYWORDS = ["admin", "free robux", "hack", "exploit", "scam", "bypass", "cheat"];
function getSusGroups(groups) {
  return groups.filter((g) =>
    SUSPICIOUS_KEYWORDS.some((k) =>
      g.group?.name?.toLowerCase().includes(k)
    )
  );
}

// ─── Anthropic AI helper ──────────────────────────────────────────────────────
async function callAI(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await r.json();
  return d.content?.[0]?.text ?? "Could not generate response.";
}

// ─── Discord follow-up helper ─────────────────────────────────────────────────
async function followUp(token, appId, interactionToken, payload) {
  await fetch(
    `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

// ─── Command handlers ─────────────────────────────────────────────────────────
async function handleAltcheck(user, appId, interactionToken) {
  const [info, badges, friends, groups, headshot] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getHeadshot(user.id),
  ]);

  const ageDays = accountAgeInDays(info.created);
  const altScore = calcAltScore(ageDays, badges.length, friends, groups.length);
  const verdict = altVerdict(altScore);

  const reasons = [];
  if (ageDays < 30) reasons.push("• Account is very new (under 30 days)");
  if (ageDays < 90 && ageDays >= 30) reasons.push("• Account is relatively new (under 90 days)");
  if (badges.length < 5) reasons.push("• Very few badges earned");
  if (friends < 5) reasons.push("• Very few friends");
  if (groups.length < 2) reasons.push("• Barely any group memberships");
  if (reasons.length === 0) reasons.push("• No major alt indicators found");

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: verdict.color,
      title: `🔍 Alt Check — ${info.displayName}`,
      thumbnail: headshot ? { url: headshot } : undefined,
      fields: [
        { name: "Verdict", value: verdict.label, inline: true },
        { name: "Alt Score", value: `${altScore}/100`, inline: true },
        { name: "Account Age", value: formatAge(ageDays), inline: true },
        { name: "Badges", value: `${badges.length}`, inline: true },
        { name: "Friends", value: `${friends}`, inline: true },
        { name: "Groups", value: `${groups.length}`, inline: true },
        { name: "Why?", value: reasons.join("\n") },
      ],
      footer: { text: `roblox.com/users/${user.id}/profile` },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleTrust(user, appId, interactionToken) {
  const [info, badges, friends, groups, followers, headshot] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getFollowersCount(user.id),
    getHeadshot(user.id),
  ]);

  const ageDays = accountAgeInDays(info.created);
  const trustScore = calcTrustScore(ageDays, badges.length, friends, groups.length, followers);
  const verdict = trustVerdict(trustScore);

  const bar = "█".repeat(Math.round(trustScore / 10)) + "░".repeat(10 - Math.round(trustScore / 10));

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: verdict.color,
      title: `🤝 Trust Score — ${info.displayName}`,
      thumbnail: headshot ? { url: headshot } : undefined,
      description: `\`${bar}\` **${trustScore}/100**`,
      fields: [
        { name: "Verdict", value: verdict.label, inline: false },
        { name: "Account Age", value: formatAge(ageDays), inline: true },
        { name: "Badges", value: `${badges.length}`, inline: true },
        { name: "Friends", value: `${friends}`, inline: true },
        { name: "Followers", value: `${followers}`, inline: true },
        { name: "Groups", value: `${groups.length}`, inline: true },
      ],
      footer: { text: "Higher score = safer to trade with" },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleSafe(user, appId, interactionToken) {
  const [info, badges, friends, groups, followers, headshot] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getFollowersCount(user.id),
    getHeadshot(user.id),
  ]);

  const ageDays = accountAgeInDays(info.created);
  const altScore = calcAltScore(ageDays, badges.length, friends, groups.length);
  const trustScore = calcTrustScore(ageDays, badges.length, friends, groups.length, followers);
  const susGroups = getSusGroups(groups);
  const verdict = safetyVerdict(altScore, trustScore, susGroups.length);

  const flags = [];
  if (altScore >= 45) flags.push("⚠️ Possible alt account");
  if (susGroups.length > 0) flags.push(`🚩 In suspicious groups: ${susGroups.map(g => g.group.name).join(", ")}`);
  if (friends < 5) flags.push("⚠️ Very low friend count");
  if (ageDays < 30) flags.push("⚠️ Brand new account");
  if (flags.length === 0) flags.push("✅ No red flags detected");

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: verdict.color,
      title: `🛡️ Safety Check — ${info.displayName}`,
      thumbnail: headshot ? { url: headshot } : undefined,
      fields: [
        { name: "Safety Verdict", value: verdict.label, inline: false },
        { name: "Alt Score", value: `${altScore}/100`, inline: true },
        { name: "Trust Score", value: `${trustScore}/100`, inline: true },
        { name: "Sus Groups", value: `${susGroups.length}`, inline: true },
        { name: "Account Age", value: formatAge(ageDays), inline: true },
        { name: "Friends", value: `${friends}`, inline: true },
        { name: "Badges", value: `${badges.length}`, inline: true },
        { name: "🚩 Flags", value: flags.join("\n") },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleWorth(user, appId, interactionToken) {
  const [info, badges, friends, groups, followers, headshot] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getFollowersCount(user.id),
    getHeadshot(user.id),
  ]);

  const ageDays = accountAgeInDays(info.created);
  const worth = calcWorth(ageDays, badges.length, friends, groups.length, followers);

  const tier =
    worth >= 10000 ? { label: "💎 Legendary Account", color: 0x00ccff } :
    worth >= 5000 ? { label: "🥇 Premium Account", color: 0xffaa00 } :
    worth >= 2000 ? { label: "🥈 Good Account", color: 0xaaaaaa } :
    worth >= 500 ? { label: "🥉 Average Account", color: 0xcd7f32 } :
    { label: "💀 Rookie Account", color: 0x555555 };

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: tier.color,
      title: `💰 Account Worth — ${info.displayName}`,
      thumbnail: headshot ? { url: headshot } : undefined,
      description: `Estimated value: **~${worth.toLocaleString()} Robux**`,
      fields: [
        { name: "Tier", value: tier.label, inline: false },
        { name: "Account Age", value: `${formatAge(ageDays)} (+${ageDays * 2}R)`, inline: true },
        { name: "Badges", value: `${badges.length} (+${badges.length * 15}R)`, inline: true },
        { name: "Friends", value: `${friends} (+${friends * 10}R)`, inline: true },
        { name: "Groups", value: `${groups.length} (+${groups.length * 50}R)`, inline: true },
        { name: "Followers", value: `${followers} (+${Math.min(followers * 5, 999999)}R)`, inline: true },
      ],
      footer: { text: "Estimated value based on account stats, not actual Robux value" },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleGroups(user, appId, interactionToken) {
  const [info, groups, headshot] = await Promise.all([
    getUserById(user.id),
    getGroups(user.id),
    getHeadshot(user.id),
  ]);

  const susGroups = getSusGroups(groups);
  const normalGroups = groups.filter(g => !susGroups.includes(g));

  const verdict =
    susGroups.length >= 3 ? { label: "🚨 Highly Suspicious", color: 0xff2222 } :
    susGroups.length >= 1 ? { label: "⚠️ Some Red Flags", color: 0xff9900 } :
    { label: "✅ Groups Look Clean", color: 0x00cc66 };

  const groupList = groups.slice(0, 10).map(g =>
    `${susGroups.includes(g) ? "🚩" : "✅"} **${g.group.name}** — ${g.role.name}`
  ).join("\n") || "No groups";

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: verdict.color,
      title: `👥 Group Analysis — ${info.displayName}`,
      thumbnail: headshot ? { url: headshot } : undefined,
      fields: [
        { name: "Verdict", value: verdict.label, inline: true },
        { name: "Total Groups", value: `${groups.length}`, inline: true },
        { name: "Suspicious Groups", value: `${susGroups.length}`, inline: true },
        { name: "Group List (top 10)", value: groupList },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleCompare(user1, user2, appId, interactionToken) {
  const [
    info1, info2,
    badges1, badges2,
    friends1, friends2,
    groups1, groups2,
    followers1, followers2,
    head1, head2,
  ] = await Promise.all([
    getUserById(user1.id), getUserById(user2.id),
    getBadges(user1.id), getBadges(user2.id),
    getFriendsCount(user1.id), getFriendsCount(user2.id),
    getGroups(user1.id), getGroups(user2.id),
    getFollowersCount(user1.id), getFollowersCount(user2.id),
    getHeadshot(user1.id), getHeadshot(user2.id),
  ]);

  const age1 = accountAgeInDays(info1.created);
  const age2 = accountAgeInDays(info2.created);
  const worth1 = calcWorth(age1, badges1.length, friends1, groups1.length, followers1);
  const worth2 = calcWorth(age2, badges2.length, friends2, groups2.length, followers2);

  const w = (a, b) => a > b ? "🏆" : a < b ? "💀" : "🤝";

  const winner = worth1 > worth2 ? info1.displayName : worth2 > worth1 ? info2.displayName : "Tie";

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: 0x5865f2,
      title: `⚔️ ${info1.displayName} vs ${info2.displayName}`,
      fields: [
        {
          name: "Category",
          value: "Account Age\nBadges\nFriends\nFollowers\nGroups\nEst. Worth",
          inline: true,
        },
        {
          name: info1.displayName,
          value: [
            `${w(age1, age2)} ${formatAge(age1)}`,
            `${w(badges1.length, badges2.length)} ${badges1.length}`,
            `${w(friends1, friends2)} ${friends1}`,
            `${w(followers1, followers2)} ${followers1}`,
            `${w(groups1.length, groups2.length)} ${groups1.length}`,
            `${w(worth1, worth2)} ~${worth1.toLocaleString()}R`,
          ].join("\n"),
          inline: true,
        },
        {
          name: info2.displayName,
          value: [
            `${w(age2, age1)} ${formatAge(age2)}`,
            `${w(badges2.length, badges1.length)} ${badges2.length}`,
            `${w(friends2, friends1)} ${friends2}`,
            `${w(followers2, followers1)} ${followers2}`,
            `${w(groups2.length, groups1.length)} ${groups2.length}`,
            `${w(worth2, worth1)} ~${worth2.toLocaleString()}R`,
          ].join("\n"),
          inline: true,
        },
        { name: "🏆 Winner", value: winner },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleRoast(user, appId, interactionToken) {
  const [info, badges, friends, groups, followers] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getFollowersCount(user.id),
  ]);

  const ageDays = accountAgeInDays(info.created);

  let roast;
  if (process.env.ANTHROPIC_API_KEY) {
    roast = await callAI(
      `You are a savage but funny Roblox roast bot. Roast this Roblox account in 2-3 sentences max. Be funny and creative, reference specific stats. No profanity. Account: username="${info.name}", display name="${info.displayName}", age=${formatAge(ageDays)}, badges=${badges.length}, friends=${friends}, followers=${followers}, groups=${groups.length}. Bio: "${info.description || "none"}"`
    );
  } else {
    // Fallback roast without AI
    const lines = [
      badges.length < 10 && `${info.displayName} has ${badges.length} badges — my grandma has more achievements and she doesn't even own a PC.`,
      friends < 5 && `With ${friends} friends, ${info.displayName}'s friend list is lonelier than a server shutdown notice.`,
      ageDays < 90 && `Account created ${formatAge(ageDays)} ago and already begging for attention? Bold strategy.`,
      groups.length < 2 && `Not even in 2 groups. Even the default Roblox group didn't want them.`,
    ].filter(Boolean);
    roast = lines[0] || `${info.displayName} is so average, the Roblox algorithm forgot they exist.`;
  }

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: 0xff4444,
      title: `🔥 Roast — ${info.displayName}`,
      description: roast,
      footer: { text: "This is a joke! Don't take it personally 😄" },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleGrowth(user, appId, interactionToken) {
  // Growth requires Upstash Redis. If not configured, give instructions.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    await followUp("", appId, interactionToken, {
      embeds: [{
        color: 0xff9900,
        title: "⚙️ Growth Tracking — Setup Required",
        description: "Growth tracking needs **Upstash Redis** (free) for storage.\n\n**Setup:**\n1. Go to [upstash.com](https://upstash.com) → create free account\n2. Create a Redis database\n3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`\n4. Add them to your Vercel environment variables\n\nThen `/growth` will work!",
        color: 0xff9900,
      }],
    });
    return;
  }

  const [info, badges, friends, groups, followers] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getFollowersCount(user.id),
  ]);

  const key = `rosnitch:growth:${user.id}`;
  const now = {
    badges: badges.length,
    friends,
    groups: groups.length,
    followers,
    snappedAt: new Date().toISOString(),
  };

  // Get previous snapshot
  const getRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  const getData = await getRes.json();
  const prev = getData.result ? JSON.parse(getData.result) : null;

  // Save new snapshot
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(now)),
  });

  if (!prev) {
    await followUp("", appId, interactionToken, {
      embeds: [{
        color: 0x5865f2,
        title: `📸 Growth Snapshot Saved — ${info.displayName}`,
        description: "First snapshot saved! Run `/growth` again later to see what changed.",
        fields: [
          { name: "Badges", value: `${now.badges}`, inline: true },
          { name: "Friends", value: `${now.friends}`, inline: true },
          { name: "Followers", value: `${now.followers}`, inline: true },
          { name: "Groups", value: `${now.groups}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
    return;
  }

  const diff = (a, b) => {
    const d = a - b;
    if (d > 0) return `+${d} 📈`;
    if (d < 0) return `${d} 📉`;
    return `0 ➡️`;
  };

  const snapshotDate = new Date(prev.snappedAt).toLocaleDateString();

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: 0x00cc66,
      title: `📈 Growth Report — ${info.displayName}`,
      description: `Changes since **${snapshotDate}**`,
      fields: [
        { name: "Badges", value: `${prev.badges} → ${now.badges} (${diff(now.badges, prev.badges)})`, inline: true },
        { name: "Friends", value: `${prev.friends} → ${now.friends} (${diff(now.friends, prev.friends)})`, inline: true },
        { name: "Followers", value: `${prev.followers} → ${now.followers} (${diff(now.followers, prev.followers)})`, inline: true },
        { name: "Groups", value: `${prev.groups} → ${now.groups} (${diff(now.groups, prev.groups)})`, inline: true },
      ],
      footer: { text: "Snapshot updated. Run again later to track more changes." },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleReport(user, appId, interactionToken) {
  const [info, badges, friends, groups, followers, presence, headshot] = await Promise.all([
    getUserById(user.id),
    getBadges(user.id),
    getFriendsCount(user.id),
    getGroups(user.id),
    getFollowersCount(user.id),
    getPresence(user.id),
    getHeadshot(user.id),
  ]);

  const ageDays = accountAgeInDays(info.created);
  const altScore = calcAltScore(ageDays, badges.length, friends, groups.length);
  const trustScore = calcTrustScore(ageDays, badges.length, friends, groups.length, followers);
  const worth = calcWorth(ageDays, badges.length, friends, groups.length, followers);
  const susGroups = getSusGroups(groups);
  const presenceType = presence?.userPresenceType ?? 0;
  const altV = altVerdict(altScore);
  const trustV = trustVerdict(trustScore);

  const recentBadges = badges.slice(-3).map(b => `• ${b.name}`).join("\n") || "None";

  await followUp("", appId, interactionToken, {
    embeds: [{
      color: trustV.color,
      title: `📋 Full Report — ${info.displayName} (@${info.name})`,
      thumbnail: headshot ? { url: headshot } : undefined,
      fields: [
        { name: "🟢 Status", value: `${PRESENCE_EMOJI[presenceType]} ${PRESENCE_LABEL[presenceType]}`, inline: true },
        { name: "📅 Account Age", value: formatAge(ageDays), inline: true },
        { name: "🔗 Profile", value: `[View](https://www.roblox.com/users/${user.id}/profile)`, inline: true },
        { name: "🏅 Badges", value: `${badges.length}`, inline: true },
        { name: "👥 Friends", value: `${friends}`, inline: true },
        { name: "👣 Followers", value: `${followers}`, inline: true },
        { name: "🏘️ Groups", value: `${groups.length} (${susGroups.length} suspicious)`, inline: true },
        { name: "💰 Est. Worth", value: `~${worth.toLocaleString()} Robux`, inline: true },
        { name: "🔍 Alt Score", value: `${altScore}/100 — ${altV.label}`, inline: true },
        { name: "🤝 Trust Score", value: `${trustScore}/100 — ${trustV.label}`, inline: true },
        { name: "🏅 Recent Badges", value: recentBadges },
        info.description ? { name: "📝 Bio", value: info.description.slice(0, 200) } : null,
      ].filter(Boolean),
      footer: { text: `RoSnitch • User ID: ${user.id}` },
      timestamp: new Date().toISOString(),
    }],
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).send("🕵️ RoSnitch is running!");
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  const rawBody = JSON.stringify(req.body);

  const isValid = await verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);
  if (!isValid) return res.status(401).send("Invalid signature");

  const interaction = req.body;

  // Ping
  if (interaction.type === 1) return res.status(200).json({ type: 1 });

  // Commands
  if (interaction.type === 2) {
    const { name, options } = interaction.data;
    const appId = process.env.DISCORD_APP_ID;
    const token = interaction.token;

    // Respond with deferred ephemeral immediately
    res.status(200).json({ type: 5, data: { flags: 64 } });

    try {
      if (name === "altcheck" || name === "trust" || name === "safe" || name === "worth" || name === "groups" || name === "roast" || name === "growth" || name === "report") {
        const username = options.find(o => o.name === "username")?.value;
        const robloxUser = await getUserByUsername(username);
        if (!robloxUser) {
          return followUp("", appId, token, { content: `❌ No Roblox user found: **${username}**` });
        }

        if (name === "altcheck") return handleAltcheck(robloxUser, appId, token);
        if (name === "trust") return handleTrust(robloxUser, appId, token);
        if (name === "safe") return handleSafe(robloxUser, appId, token);
        if (name === "worth") return handleWorth(robloxUser, appId, token);
        if (name === "groups") return handleGroups(robloxUser, appId, token);
        if (name === "roast") return handleRoast(robloxUser, appId, token);
        if (name === "growth") return handleGrowth(robloxUser, appId, token);
        if (name === "report") return handleReport(robloxUser, appId, token);
      }

      if (name === "compare") {
        const u1 = options.find(o => o.name === "user1")?.value;
        const u2 = options.find(o => o.name === "user2")?.value;
        const [roblox1, roblox2] = await Promise.all([getUserByUsername(u1), getUserByUsername(u2)]);
        if (!roblox1) return followUp("", appId, token, { content: `❌ User not found: **${u1}**` });
        if (!roblox2) return followUp("", appId, token, { content: `❌ User not found: **${u2}**` });
        return handleCompare(roblox1, roblox2, appId, token);
      }
    } catch (err) {
      console.error(`[RoSnitch] Error in /${name}:`, err);
      return followUp("", appId, token, { content: "❌ Something went wrong. Try again!" });
    }
  }

  return res.status(200).json({ type: 1 });
}
