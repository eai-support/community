#!/usr/bin/env node

"use strict";

const { isUtf8 } = require("node:buffer");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const KNOWN_TEXT_EXTENSIONS = new Set([
  ".bash",
  ".cfg",
  ".csv",
  ".css",
  ".cjs",
  ".conf",
  ".gql",
  ".graphql",
  ".htm",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".kt",
  ".log",
  ".md",
  ".mjs",
  ".properties",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);
const SAFE_EXTENSIONLESS_FILES = new Set(["codeowners", "license", "notice"]);
const RISKY_EXTENSIONS = new Set([
  ".cer",
  ".crt",
  ".der",
  ".jks",
  ".key",
  ".keystore",
  ".p12",
  ".pem",
  ".pfx",
]);

const RULES = [
  {
    code: "credential-material",
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,}|["']?(?:token|password|secret|authorization|api[_\s-]?key)\b\s*["']?\s*[:=]\s*["']?[^\s"'{}[\]]{8,})/giu,
  },
  {
    code: "customer-or-tenant-identifier",
    pattern:
      /["']?\b(?:customer|tenant|account)[_\s-]?id\b\s*["']?\s*[:=]\s*[^\s,;]+/giu,
  },
  {
    code: "private-repository-topology",
    pattern:
      /["']?\bprivate[_\s-]+repositor(?:y|ies)\b\s*["']?\s*[:=]\s*[^\s,;]+/giu,
  },
  {
    code: "private-project-or-delivery-metadata",
    pattern:
      /(?:["']?\b(?:private[_\s-]+project(?:[_\s-]+(?:id|url))?|private[_\s-]+delivery[_\s-]+(?:link|reference)|internal[_\s-]+owner|delivery[_\s-]+reference)\b\s*["']?\s*[:=]\s*[^\s,;]+|https:\/\/github\.com\/orgs\/[^/\s]+\/projects\/\d+)/giu,
  },
  {
    code: "contractual-metadata",
    pattern:
      /\b(?:contractual\s+tier|priority|target\s+date|root\s+cause)\s*[:=]\s*[^\n]+/giu,
  },
  {
    code: "private-url",
    pattern: /https:\/\/(?:private|internal|corp|intranet)\.[^\s)"']+/giu,
  },
  {
    code: "vulnerability-content",
    pattern: /\bvulnerability\s+(?:body|payload|exploit)\s*[:=]\s*[^\n]+/giu,
  },
  {
    code: "unsanitized-log",
    pattern: /\b(?:raw|unsanitized)\s+logs?\s*[:=]\s*[^\n]+/giu,
  },
];

function sensitiveKeyCode(key) {
  const normalizedKey = String(key)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (/^(?:customer|tenant|account)_?id$/.test(normalizedKey)) {
    return "customer-or-tenant-identifier";
  }
  if (/^private_repositor(?:y|ies)$/.test(normalizedKey)) {
    return "private-repository-topology";
  }
  if (
    /^(?:private_project(?:_id|_url)?|private_delivery_(?:link|reference)|internal_owner|delivery_reference)$/.test(
      normalizedKey,
    )
  ) {
    return "private-project-or-delivery-metadata";
  }
  if (/^(?:token|password|secret|authorization|api_key)$/.test(normalizedKey)) {
    return "credential-material";
  }
  return null;
}

function scanStructuredValue(value, sourcePath, ancestors = []) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      scanStructuredValue(entry, sourcePath, [...ancestors, String(index)]),
    );
  }
  if (!value || typeof value !== "object") return [];

  const findings = [];
  for (const [key, entry] of Object.entries(value)) {
    const code = sensitiveKeyCode(key);
    if (code) {
      findings.push({
        code,
        path: sourcePath,
        location: [...ancestors, key].join("."),
      });
    }
    findings.push(...scanStructuredValue(entry, sourcePath, [...ancestors, key]));
  }
  return findings;
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += character;
      }
      continue;
    }
    if (quoteClosed && ![",", "\r", "\n"].includes(character)) {
      throw new Error("Unexpected character after quoted CSV field");
    }
    if (character === '"' && field.length === 0 && !quoteClosed) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
      quoteClosed = false;
    } else if (character === "\r" && content[index + 1] === "\n") {
      continue;
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      quoteClosed = false;
    } else if (character === '"') {
      throw new Error("Unexpected quote in unquoted CSV field");
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Unterminated CSV field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length > 0) {
    const width = rows[0].length;
    if (
      width === 0 ||
      rows.some((value) => value.length !== width) ||
      rows[0].some((value) => value.trim() === "")
    ) {
      throw new Error("CSV rows or headers are inconsistent");
    }
  }
  return rows;
}

function scanCsvValue(rows, sourcePath) {
  if (rows.length === 0) return [];
  const headers = rows[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
  );
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new Error("CSV headers must be unique");
  }
  const findings = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    for (let column = 0; column < headers.length; column += 1) {
      const code = sensitiveKeyCode(headers[column] ?? "");
      if (code && String(rows[rowIndex][column] ?? "").trim() !== "") {
        findings.push({
          code,
          path: sourcePath,
          location: `row-${rowIndex + 1}.${headers[column]}`,
        });
      }
    }
  }
  return findings;
}

function parseYaml(content) {
  const script = [
    "input = STDIN.read",
    "value = YAML.safe_load(",
    "  input,",
    "  permitted_classes: [],",
    "  permitted_symbols: [],",
    "  aliases: false",
    ")",
    "STDOUT.write(JSON.generate(value))",
  ].join("\n");
  const result = spawnSync(
    "ruby",
    ["-ryaml", "-rjson", "-e", script],
    {
      input: content,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error("YAML parsing failed");
  }
  return JSON.parse(result.stdout);
}

function scanPublicText(content, { path: sourcePath = "unknown" } = {}) {
  const findings = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      findings.push({
        code: rule.code,
        path: sourcePath,
        line: content.slice(0, match.index).split("\n").length,
      });
    }
  }

  const extension = path.extname(sourcePath).toLowerCase();
  if (
    extension === ".json" ||
    extension === ".yaml" ||
    extension === ".yml"
  ) {
    try {
      const parsed =
        extension === ".json" ? JSON.parse(content) : parseYaml(content);
      if (!parsed || typeof parsed !== "object") {
        findings.push({ code: "structured-root-required", path: sourcePath });
      } else {
        findings.push(...scanStructuredValue(parsed, sourcePath));
      }
    } catch {
      findings.push({ code: "structured-parse-error", path: sourcePath });
    }
  }
  if (extension === ".csv") {
    try {
      findings.push(...scanCsvValue(parseCsv(content), sourcePath));
    } catch {
      findings.push({ code: "structured-parse-error", path: sourcePath });
    }
  }
  return findings;
}

function fileSafetyFindings(content, sourcePath) {
  const findings = [];
  const basename = path.basename(sourcePath).toLowerCase();
  const extension = path.extname(basename).toLowerCase();
  if (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename === ".npmrc" ||
    RISKY_EXTENSIONS.has(extension)
  ) {
    findings.push({ code: "risky-public-file", path: sourcePath });
  }
  if (!isUtf8(content) || content.includes(0)) {
    findings.push({ code: "binary-file-requires-review", path: sourcePath });
    return { findings, text: null };
  }
  if (
    !KNOWN_TEXT_EXTENSIONS.has(extension) &&
    !(extension === "" && SAFE_EXTENSIONLESS_FILES.has(basename))
  ) {
    findings.push({ code: "unreviewed-file-type", path: sourcePath });
  }
  return { findings, text: content.toString("utf8") };
}

function collectFiles(target) {
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const entryPath = path.join(target, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Public boundary refuses symbolic link ${entryPath}`);
    } else if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function scanPublicTree(root = ".") {
  const files = collectFiles(root).sort();
  const findings = [];
  for (const file of files) {
    const safety = fileSafetyFindings(fs.readFileSync(file), file);
    findings.push(...safety.findings);
    if (safety.text !== null) {
      findings.push(...scanPublicText(safety.text, { path: file }));
    }
  }
  return { files_scanned: files.length, findings };
}

module.exports = { scanPublicText, scanPublicTree };

if (require.main === module) {
  const result = scanPublicTree(process.argv[2] ?? ".");
  if (result.findings.length > 0) {
    process.stderr.write(
      `${JSON.stringify({ status: "fail", ...result }, null, 2)}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(`${JSON.stringify({ status: "pass", ...result })}\n`);
  }
}
