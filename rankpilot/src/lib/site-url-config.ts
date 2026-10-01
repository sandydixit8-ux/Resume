/**
 * Names and defaults for the public site URL.
 *
 * Kept in its own file so the env var name and the localhost default cannot be
 * defined twice with different values, and so anything that needs the constant
 * can import it without pulling in the resolver (which imports it back).
 */

/**
 * The variable to set in production. Documented in .env.example.
 *
 * Deliberately NOT named NEXT_PUBLIC_SITE_URL. Next.js inlines any
 * NEXT_PUBLIC_* variable into the client bundle at BUILD time, which means a
 * value supplied only in a server's EnvironmentFile is invisible to the code
 * that reads it: canonical tags, sitemap.xml and robots.txt all ship pointing at
 * localhost, and nothing errors. Every consumer here is server-rendered, so this
 * is a runtime value and is named accordingly.
 */
export const SITE_URL_ENV = "SITE_URL";

/** Used in development, and the value that signals "never configured". */
export const LOCALHOST_SITE_URL = "http://localhost:3000";
