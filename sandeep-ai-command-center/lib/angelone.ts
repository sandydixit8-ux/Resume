import { promises as fs } from "fs";
import path from "path";

const ROOT = "https://apiconnect.angelone.in";
const LOGIN_URL = "/rest/auth/angelbroking/user/v1/loginByPassword";
const PROFILE_URL = "/rest/secure/angelbroking/user/v1/getProfile";
const REFRESH_URL = "/rest/auth/angelbroking/jwt/v1/generateTokens";

const HOLDING_URL = "/rest/secure/angelbroking/portfolio/v1/getHolding";
const POSITION_URL = "/rest/secure/angelbroking/order/v1/getPosition";
const RMS_URL = "/rest/secure/angelbroking/user/v1/getRMS";
const CANDLE_URL = "/rest/secure/angelbroking/historical/v1/getCandleData";
const QUOTE_URL = "/rest/secure/angelbroking/market/v1/quote";
const GAINERS_URL = "/rest/secure/angelbroking/marketData/v1/gainersLosers";
const PCR_URL = "/rest/secure/angelbroking/marketData/v1/putCallRatio";
const OIBUILDUP_URL = "/rest/secure/angelbroking/marketData/v1/OIBuildup";
const NSE_INTRADAY_URL = "/rest/secure/angelbroking/marketData/v1/nseIntraday";
const BSE_INTRADAY_URL = "/rest/secure/angelbroking/marketData/v1/bseIntraday";
const SEARCH_URL = "/rest/secure/angelbroking/order/v1/searchScrip";

const STORE_DIR = path.join(process.cwd(), ".angelone");
const CONFIG_FILE = path.join(STORE_DIR, "config.json");
const SESSION_FILE = path.join(STORE_DIR, "session.json");

type Config = {
  apiKey: string;
  clientId: string;
};

type Session = {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  clientId: string;
  createdAt: number;
};

export class AngelError extends Error {  code?: string;
  status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "AngelError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getConfig(): Promise<Config | null> {
  return readJson<Config>(CONFIG_FILE);
}

export async function saveConfig(cfg: Config): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function getSession(): Promise<Session | null> {
  return readJson<Session>(SESSION_FILE);
}

export async function saveSession(sess: Session): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify(sess, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function clearSession(): Promise<void> {
  try {
    await fs.rm(SESSION_FILE, { force: true });
  } catch {
    /* ignore */
  }
}

export type AuthedContext = {
  config: Config;
  session: Session;
};

export async function getAuthedContext(): Promise<AuthedContext> {
  const config = await getConfig();
  if (!config?.apiKey) {
    throw new AngelError("No API key configured. Set it up on /roles first.", {
      status: 400,
    });
  }
  let session = await getSession();
  if (!session) {
    throw new AngelError("Not connected to Angel One. Log in on /roles first.", {
      status: 401,
    });
  }
  if (sessionExpired(session)) {
    if (!session.refreshToken) {
      throw new AngelError("Session expired. Re-login on /roles.", {
        status: 401,
      });
    }
    try {
      session = await refreshToken(session);
    } catch {
      throw new AngelError("Session expired and refresh failed. Re-login on /roles.", {
        status: 401,
      });
    }
  }
  return { config, session };
}

export function sessionExpired(sess: Session): boolean {
  const day = 24 * 60 * 60 * 1000;
  return Date.now() - sess.createdAt > day;
}

function networkHeaders(apiKey: string) {
  return {
    "X-PrivateKey": apiKey,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "192.168.168.168",
    "X-ClientPublicIP": "106.193.147.98",
    "X-MACAddress": "fe80::216e:6507:4b90:3719",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function authHeaders(apiKey: string, jwt: string) {
  return {
    ...networkHeaders(apiKey),
    Authorization: `Bearer ${jwt}`,
  };
}

async function post<T>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ROOT}${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AngelError(`Network error connecting to Angel One: ${(err as Error).message}`, {
      status: 0,
    });
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error?.message ||
      res.headers.get("x-error-message") ||
      `HTTP ${res.status}`;
    throw new AngelError(msg, {
      code: json?.errorCode ?? json?.code,
      status: res.status,
    });
  }

  if (json && json.status === false) {
    throw new AngelError(json.message || "Angel One request failed", {
      code: json.errorCode,
      status: res.status,
    });
  }

  return json as T;
}

export async function loginByPassword(opts: {
  apiKey: string;
  clientId: string;
  pin: string;
  totp: string;
}): Promise<Session> {
  const json = await post<{
    data: { jwtToken: string; refreshToken: string; feedToken: string; [k: string]: unknown };
  }>(LOGIN_URL, networkHeaders(opts.apiKey), {
    clientcode: opts.clientId,
    password: opts.pin,
    totp: opts.totp,
  });

  if (!json.data?.jwtToken) {
    throw new AngelError("Login succeeded but no jwtToken was returned.");
  }

  const session: Session = {
    jwtToken: json.data.jwtToken,
    refreshToken: json.data.refreshToken || "",
    feedToken: json.data.feedToken || "",
    clientId: opts.clientId,
    createdAt: Date.now(),
  };
  await saveSession(session);
  return session;
}

export async function refreshToken(session: Session): Promise<Session> {
  const json = await post<{
    data: { jwtToken?: string; refreshToken?: string; feedToken?: string };
  }>(REFRESH_URL, networkHeaders(session.clientId), {
    refreshToken: session.refreshToken,
  });

  const next: Session = {
    ...session,
    jwtToken: json.data?.jwtToken || session.jwtToken,
    refreshToken: json.data?.refreshToken || session.refreshToken,
    feedToken: json.data?.feedToken || session.feedToken,
    createdAt: Date.now(),
  };
  await saveSession(next);
  return next;
}

export type Profile = {
  clientcode: string;
  name: string;
  email?: string;
  mobileno?: string;
  [k: string]: unknown;
};

export async function getProfile(session: Session, apiKey: string): Promise<Profile> {
  const json = await post<{ data: Profile }>(
    PROFILE_URL,
    authHeaders(apiKey, session.jwtToken),
    {}
  );
  return json.data;
}

async function authedPost<T>(
  session: Session,
  apiKey: string,
  url: string,
  body: unknown
): Promise<T> {
  const json = await post<{ data: T; message?: string }>(
    url,
    authHeaders(apiKey, session.jwtToken),
    body
  );
  return (json as { data: T }).data;
}

async function authedGet<T>(
  session: Session,
  apiKey: string,
  url: string
): Promise<T> {
  const res = await fetch(`${ROOT}${url}`, {
    method: "GET",
    headers: authHeaders(apiKey, session.jwtToken),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error?.message ||
      res.headers.get("x-error-message") ||
      `HTTP ${res.status}`;
    throw new AngelError(msg, {
      code: json?.errorCode ?? json?.code,
      status: res.status,
    });
  }
  if (json && json.status === false) {
    throw new AngelError(json.message || "Angel One request failed", {
      code: json.errorCode,
      status: res.status,
    });
  }
  return json.data as T;
}

export type Holding = {
  tradingSymbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPerc: number;
  [k: string]: unknown;
};

export async function getHoldings(session: Session, apiKey: string): Promise<Holding[]> {
  const data = await authedPost<unknown>(session, apiKey, HOLDING_URL, {});
  if (Array.isArray(data)) return data as Holding[];
  return [];
}

export type Position = {
  tradingSymbol: string;
  exchange: string;
  symbolToken: string;
  netqty: number;
  netavgprice: number;
  ltp: number;
  pnl: number;
  producttype: string;
  [k: string]: unknown;
};

export async function getPositions(session: Session, apiKey: string): Promise<Position[]> {
  const data = await authedPost<unknown>(session, apiKey, POSITION_URL, {});
  if (Array.isArray(data)) return data as Position[];
  return [];
}

export type RMS = {
  availablecash: number;
  utilisablemargin: number;
  [k: string]: unknown;
};

export async function getRMS(session: Session, apiKey: string): Promise<RMS | null> {
  const data = await authedPost<RMS>(session, apiKey, RMS_URL, {});
  return data || null;
}

export type Candle = [number, number, number, number, number, number];

export async function getCandleData(
  session: Session,
  apiKey: string,
  opts: {
    exchange: string;
    symboltoken: string;
    interval: string;
    fromdate: string;
    todate: string;
  }
): Promise<Candle[]> {
  const data = await authedPost<unknown>(session, apiKey, CANDLE_URL, opts);
  if (Array.isArray(data)) return data as Candle[];
  if (data && typeof data === "object") {
    const inner = (data as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as Candle[];
  }
  return [];
}

export type Scrip = {
  symboltoken: string;
  tradingsymbol: string;
  exchange: string;
  symbolname: string;
  [k: string]: unknown;
};

export async function searchScrip(
  session: Session,
  apiKey: string,
  exchange: string,
  symbol: string
): Promise<Scrip[]> {
  const data = await authedPost<unknown>(session, apiKey, SEARCH_URL, {
    exchange,
    searchscrip: symbol,
  });
  if (Array.isArray(data)) return data as Scrip[];
  return [];
}

export type Quote = {
  symboltoken: string;
  tradingsymbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  netchange: number;
  percentChange: number;
  [k: string]: unknown;
};

export async function getQuotes(
  session: Session,
  apiKey: string,
  exchangeTokens: Record<string, string[]>
): Promise<Quote[]> {
  const data = await authedPost<unknown>(session, apiKey, QUOTE_URL, {
    mode: "FULL",
    exchangeTokens,
  });
  if (Array.isArray(data)) return data as Quote[];
  if (data && typeof data === "object") {
    const inner = (data as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as Quote[];
  }
  return [];
}

export type BreadthItem = {
  tradingsymbol: string;
  exchange: string;
  symboltoken: string;
  lastprice: number;
  percentChange: number;
  [k: string]: unknown;
};

export type GainersLosers = {
  gainers: BreadthItem[];
  losers: BreadthItem[];
};

export async function getGainersLosers(
  session: Session,
  apiKey: string,
  duration: string,
  exchange: string
): Promise<GainersLosers> {
  const data = await authedPost<unknown>(session, apiKey, GAINERS_URL, {
    duration,
    exchange,
  });
  if (data && typeof data === "object") {
    const asRecord = data as Record<string, unknown>;
    if (Array.isArray(asRecord.gainers) || Array.isArray(asRecord.losers)) {
      return {
        gainers: (asRecord.gainers as BreadthItem[]) || [],
        losers: (asRecord.losers as BreadthItem[]) || [],
      };
    }
  }
  if (Array.isArray(data)) {
    return { gainers: data as BreadthItem[], losers: [] };
  }
  return { gainers: [], losers: [] };
}

export async function getPutCallRatio(
  session: Session,
  apiKey: string
): Promise<unknown> {
  return authedGet<unknown>(session, apiKey, PCR_URL);
}

export type OIBuildup = {
  tradingsymbol: string;
  exchange: string;
  symboltoken: string;
  [k: string]: unknown;
};

export async function getOIBuildup(
  session: Session,
  apiKey: string,
  exchange: string,
  symboltoken: string
): Promise<OIBuildup[]> {
  const data = await authedPost<unknown>(session, apiKey, OIBUILDUP_URL, {
    exchange,
    symboltoken,
  });
  if (Array.isArray(data)) return data as OIBuildup[];
  return [];
}

export async function getNSEIntraday(
  session: Session,
  apiKey: string
): Promise<BreadthItem[]> {
  const data = await authedGet<unknown>(session, apiKey, NSE_INTRADAY_URL);
  if (Array.isArray(data)) return data as BreadthItem[];
  if (data && typeof data === "object") {
    const inner = (data as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as BreadthItem[];
  }
  return [];
}

export async function getBSEIntraday(
  session: Session,
  apiKey: string
): Promise<BreadthItem[]> {
  const data = await authedGet<unknown>(session, apiKey, BSE_INTRADAY_URL);
  if (Array.isArray(data)) return data as BreadthItem[];
  if (data && typeof data === "object") {
    const inner = (data as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as BreadthItem[];
  }
  return [];
}
