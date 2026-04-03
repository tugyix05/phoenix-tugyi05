const crypto = require("crypto");

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  // Pre-flight request (CORS) အတွက် လိုအပ်သည်
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // ၁။ ကိုယ်ပိုင် KeyPair အသစ်ထုတ်ခြင်း
    const { privateKey, publicKey } = crypto.generateKeyPairSync("x25519");
    const priv = privateKey.export({ format: "der", type: "pkcs8" }).subarray(16).toString("base64");
    const pub  = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("base64");

    // ၂။ Cloudflare API သို့ Register လုပ်ရန် Data ပြင်ဆင်ခြင်း
    const installId = crypto.randomBytes(11).toString("hex");
    const body = {
      key: pub,
      install_id: installId,
      fcm_token: installId + ":APA91b" + crypto.randomBytes(67).toString("base64"),
      tos: new Date().toISOString(),
      model: "Android",
      type: "Android",
      locale: "en_US",
    };

    // ၃။ Cloudflare API သို့ လှမ်းခေါ်ခြင်း (Key အစစ်ရရန်)
    const warpRes = await fetch("https://api.cloudflareclient.com/v0a884/reg", {
      method: "POST",
      headers: {
        "User-Agent": "okhttp/3.12.1",
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    });

    let configStr = "";

    if (warpRes.ok) {
      const data = await warpRes.json();
      const v4      = data.config.interface.addresses.v4;
      const v6      = data.config.interface.addresses.v6;
      const peerPub = data.config.peers[0].public_key;

      // သင်သတ်မှတ်ထားသော DNS နှင့် Endpoint အတိုင်း တည်ဆောက်ခြင်း
      configStr =
`[Interface]
PrivateKey = ${priv}
Address = ${v4}/32
Address = ${v6}/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280

[Peer]
PublicKey = ${peerPub}
AllowedIPs = 0.0.0.0/0
AllowedIPs = ::/0
Endpoint = 162.159.192.1:500
PersistentKeepalive = 20`;
    } else {
      // API အလုပ်မလုပ်လျှင် Default Config ထုတ်ပေးရန်
      configStr =
`[Interface]
PrivateKey = ${priv}
Address = 172.16.0.2/32
Address = 2606:4700:110:8f81:d551:a0:532e:a2b3/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280

[Peer]
PublicKey = bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=
AllowedIPs = 0.0.0.0/0
AllowedIPs = ::/0
Endpoint = 162.159.192.1:500
PersistentKeepalive = 20`;
    }

    // ၄။ PHX-VPN-ONLY ကို ဖြုတ်ပြီး configStr ကိုပဲ တိုက်ရိုက်ပြန်ပေးခြင်း
    return { statusCode: 200, headers, body: JSON.stringify({ config: configStr }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ message: "Failed to generate configuration." }) };
  }
};
