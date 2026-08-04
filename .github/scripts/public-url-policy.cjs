const { isIP } = require("node:net");

const RESERVED_HOSTS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example",
  "home.arpa",
  "invalid",
  "localhost",
  "alt",
  "arpa",
  "onion",
  "test",
]);
const RESERVED_SUFFIXES = [
  ".alt",
  ".arpa",
  ".example",
  ".example.com",
  ".example.net",
  ".example.org",
  ".invalid",
  ".local",
  ".localhost",
  ".internal",
  ".home.arpa",
  ".onion",
  ".test",
];

function parseIpv4(hostname) {
  if (isIP(hostname) !== 4) return null;
  return hostname.split(".").map(Number);
}

function isSpecialUseIpv4(octets) {
  const [first, second, third] = octets;
  // IANA IPv4 Special-Purpose Address Registry, last updated 2025-10-09:
  // https://www.iana.org/assignments/iana-ipv4-special-registry/
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 31 && third === 196) ||
    (first === 192 && second === 52 && third === 193) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 175 && third === 48) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function parseIpv6Bytes(hostname) {
  if (isIP(hostname) !== 6) return null;
  const halves = hostname.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (half) =>
    half
      ? half.split(":").flatMap((part, index, parts) => {
          if (part.includes(".")) {
            const ipv4 = parseIpv4(part);
            if (!ipv4 || index !== parts.length - 1) {
              throw new Error("Invalid embedded IPv4 address");
            }
            return [
              (ipv4[0] << 8) | ipv4[1],
              (ipv4[2] << 8) | ipv4[3],
            ];
          }
          const value = Number.parseInt(part, 16);
          if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
            throw new Error("Invalid IPv6 hextet");
          }
          return [value];
        })
      : [];
  try {
    const left = parseHalf(halves[0]);
    const right = parseHalf(halves[1] ?? "");
    const missing = 8 - left.length - right.length;
    if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
    const hextets = [...left, ...Array(missing).fill(0), ...right];
    if (hextets.length !== 8) return null;
    return hextets.flatMap((value) => [value >> 8, value & 0xff]);
  } catch {
    return null;
  }
}

// IANA IPv6 Special-Purpose Address Registry, last updated 2025-10-09:
// https://www.iana.org/assignments/iana-ipv6-special-registry/
// Public support destinations are deliberately stricter than raw routability:
// any registered special-purpose block is rejected, as are deprecated
// site-local/multicast space and addresses outside 2000::/3.
const SPECIAL_PURPOSE_IPV6_CIDRS = Object.freeze([
  "::/96",
  "::ffff:0:0/96",
  "64:ff9b::/96",
  "64:ff9b:1::/48",
  "100::/64",
  "100:0:0:1::/64",
  "2001::/23",
  "2001:db8::/32",
  "2002::/16",
  "2620:4f:8000::/48",
  "3fff::/20",
  "5f00::/16",
  "fc00::/7",
  "fe80::/10",
  "fec0::/10",
  "ff00::/8",
]);

function matchesIpv6Cidr(bytes, cidr) {
  const [prefixValue, lengthValue] = cidr.split("/");
  const prefix = parseIpv6Bytes(prefixValue);
  const length = Number(lengthValue);
  if (!prefix || !Number.isInteger(length) || length < 0 || length > 128) {
    throw new Error(`Invalid built-in IPv6 CIDR: ${cidr}`);
  }
  const wholeBytes = Math.floor(length / 8);
  for (let index = 0; index < wholeBytes; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  const remainingBits = length % 8;
  if (remainingBits === 0) return true;
  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (bytes[wholeBytes] & mask) === (prefix[wholeBytes] & mask);
}

function isSpecialUseIpv6(bytes) {
  const inGlobalUnicast = matchesIpv6Cidr(bytes, "2000::/3");
  return (
    !inGlobalUnicast ||
    SPECIAL_PURPOSE_IPV6_CIDRS.some((cidr) => matchesIpv6Cidr(bytes, cidr))
  );
}

function isSpecialUseHostname(hostname) {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  if (
    RESERVED_HOSTS.has(normalized) ||
    RESERVED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    return true;
  }
  const ipv4 = parseIpv4(normalized);
  if (ipv4) return isSpecialUseIpv4(ipv4);
  const ipv6 = parseIpv6Bytes(normalized);
  if (ipv6) return isSpecialUseIpv6(ipv6);
  return !normalized.includes(".");
}

module.exports = { isSpecialUseHostname };
