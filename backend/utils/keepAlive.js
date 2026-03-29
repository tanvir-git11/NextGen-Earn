const axios = require('axios');

/**
 * Pings the server periodically to prevent Render from sleeping.
 * Render free tier sleeps after 15 mins of inactivity.
 * By pinging every 14 mins, we keep it awake.
 */
const startKeepAlive = () => {
  const url = process.env.RENDER_EXTERNAL_URL || 'https://nextgen-earn.onrender.com';
  
  if (!url) {
    console.warn('[Keep-Alive] No URL defined, skipping pings.');
    return;
  }

  console.log(`[Keep-Alive] Starting pings to ${url} every 14 minutes...`);

  // Ping immediately on start
  ping(url);

  // Set interval to 14 minutes (14 * 60 * 1000 ms)
  setInterval(() => {
    ping(url);
  }, 14 * 60 * 1000);
};

const ping = async (url) => {
  try {
    const start = Date.now();
    // Ping the status endpoint or root
    const statusUrl = `${url.replace(/\/$/, '')}/status`;
    const res = await axios.get(statusUrl);
    const duration = Date.now() - start;
    console.log(`[Keep-Alive] Ping successful: ${res.status} (${duration}ms)`);
  } catch (err) {
    console.error(`[Keep-Alive] Ping failed: ${err.message}`);
  }
};

module.exports = { startKeepAlive };
