/** Express's `trust proxy` setting: off, every hop, a hop count, or named proxy addresses. */
export type TrustProxySetting = boolean | number | string[];

const HOP_COUNT = /^\d+$/;

/**
 * Reads `TRUST_PROXY`. Behind a load balancer the socket address is the balancer's, so every
 * visitor would share one rate-limit budget and one speech slot; naming the proxy lets `req.ip`
 * be the visitor again. Unset means no proxy is trusted, which is right for direct local runs and
 * stops a visitor from choosing their own address with `X-Forwarded-For`.
 *
 * Accepted values: `true` / `false`, a hop count such as `1`, or a comma-separated list of proxy
 * addresses or subnets such as `10.0.0.0/8, 172.16.0.0/12`.
 */
export const parseTrustProxy = (configured: string | undefined): TrustProxySetting => {
  const value = configured?.trim() ?? '';
  if (value === '' || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  if (HOP_COUNT.test(value)) {
    return Number(value);
  }
  return value
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address.length > 0);
};
