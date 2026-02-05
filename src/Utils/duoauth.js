import crypto from "crypto";
import axios from "axios";

function buildCanonicalParams(params) {
  return Object.keys(params)
    .sort()
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
    )
    .join("&");
}

function signDuoRequest(method, path, params, ikey, skey, host) {
  const date = new Date().toUTCString();
  const canonParams = buildCanonicalParams(params);

  const canon = [
    date,
    method.toUpperCase(),
    host.toLowerCase(),
    path,
    canonParams,
  ].join("\n");

  const signature = crypto
    .createHmac("sha1", skey)
    .update(canon, "utf8")
    .digest("hex");

  const authHeader = Buffer.from(`${ikey}:${signature}`).toString("base64");

  return {
    date,
    authHeader,
    canonParams,
  };
}

export async function duoPushAuth({ username }) {
  const host = process.env.DUO_API_HOSTNAME;
  const ikey = process.env.DUO_IKEY;
  const skey = process.env.DUO_SKEY;

  const path = "/auth/v2/auth";

  const params = {
    device: "auto",
    factor: "push",
    username,
  };

  const { date, authHeader, canonParams } = signDuoRequest(
    "POST",
    path,
    params,
    ikey,
    skey,
    host,
  );

  const response = await axios.post(`https://${host}${path}`, canonParams, {
    headers: {
      Authorization: `Basic ${authHeader}`,
      Date: date,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 65000,
    validateStatus: () => true, // let us see Duo errors
  });

  return response.data;
}
