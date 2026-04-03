const crypto = require("crypto");

exports.handler = async function (event) {
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
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

    if (!warpRes.ok) throw new Error("Cloudflare Registration Failed");

    const data = await warpRes.json();
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

    return { statusCode: 200, headers, body: JSON.stringify({ config: configStr }) };
  } catch (err) {
    // API Busy ဖြစ်ရင် Error Status 500 ပို့ပေးလိုက်ခြင်း
    return { statusCode: 500, headers, body: JSON.stringify({ message: "API Busy" }) };
  }
};
