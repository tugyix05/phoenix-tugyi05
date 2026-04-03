const crypto = require("crypto");

// Upstash Configuration
const UPSTASH_URL = "https://current-duck-66376.upstash.io";
const UPSTASH_TOKEN = "gQAAAAAAAQNIAAIncDFkYjI2NDBmNTJhN2Q0Nzk4OGYzZDBlNjg0NDExODQ0N3AxNjYzNzY"; 

exports.handler = async function (event) {
  const headers = { 
    "Access-Control-Allow-Origin": "*", 
    "Content-Type": "application/json" 
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    // ၁။ Cloudflare KeyPair ထုတ်ယူခြင်း (ပထမဆုံးအတိုင်း မူလ Logic)
    const { privateKey, publicKey } = crypto.generateKeyPairSync("x25519");
    const priv = privateKey.export({ format: "der", type: "pkcs8" }).subarray(16).toString("base64");
    const pub  = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("base64");
    const installId = crypto.randomBytes(11).toString("hex");

    const warpRes = await fetch("https://api.cloudflareclient.com/v0a884/reg", {
      method: "POST",
      headers: { "User-Agent": "okhttp/3.12.1", "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        key: pub, install_id: installId, tos: new Date().toISOString(),
        model: "Android", type: "Android", locale: "en_US",
        fcm_token: installId + ":APA91b" + crypto.randomBytes(67).toString("base64")
      }),
    });

    // Cloudflare API မရမှသာ Error ပြမည်
    if (!warpRes.ok) throw new Error("Cloudflare Failed");
    const data = await warpRes.json();

    // ၂။ Global Counter (Upstash) - ဒီအပိုင်းမှာ Error တက်ရင်လည်း Config ကို ဆက်ထုတ်ပေးမည်
    let globalCount = "..."; 
    try {
      const redisRes = await fetch(`${UPSTASH_URL}/incr/phx_global_count`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(3000) // ၃ စက္ကန့်အတွင်း အကြောင်းမပြန်ရင် ကျော်သွားမည်
      });
      if (redisRes.ok) {
        const redisData = await redisRes.json();
        globalCount = redisData.result;
      }
    } catch (e) {
      console.log("Counter Error (Skipped):", e.message);
      // Counter အလုပ်မလုပ်ရင် လက်ရှိ localStorage က နံပါတ်ကိုပဲ သုံးဖို့ placeholder ထားနိုင်သည်
    }

    const configStr = `[Interface]
PrivateKey = ${priv}
Address = ${data.config.interface.addresses.v4}/32
Address = ${data.config.interface.addresses.v6}/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280

[Peer]
PublicKey = ${data.config.peers[0].public_key}
AllowedIPs = 0.0.0.0/0
AllowedIPs = ::/0
Endpoint = 162.159.192.1:500
PersistentKeepalive = 20`;

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ config: configStr, count: globalCount }) 
    };
  } catch (err) {
    // ဤနေရာတွင် Error ပေါ်လာပါက Cloudflare ဘက်က အလုပ်မလုပ်ခြင်းသာ ဖြစ်သည်
    return { statusCode: 500, headers, body: JSON.stringify({ message: "Cloudflare Server Busy" }) };
  }
};
