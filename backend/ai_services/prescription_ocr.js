'use strict';

const { SarvamAIClient } = require('sarvamai');
const AdmZip             = require('adm-zip');
require('dotenv').config();

/**
 * Extract all text from a prescription image using Sarvam Vision OCR.
 *
 * @param {Buffer} imageBuffer  - Raw image bytes
 * @param {string} mimeType     - e.g. 'image/jpeg', 'image/png', 'application/pdf'
 * @returns {Promise<{ rawText: string }>}
 */
async function extractTextFromImage(imageBuffer, mimeType = 'image/jpeg') {
  if (!process.env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not set.');

  // Ensure we always have a real Buffer (guard against plain-object coercion)
  const safeBuffer = Buffer.isBuffer(imageBuffer)
    ? imageBuffer
    : Buffer.from(imageBuffer.data ?? imageBuffer);

  console.log(`[OCR] mimeType=${mimeType} bufferSize=${safeBuffer.byteLength}`);

  // ── Key insight ──────────────────────────────────────────────────────────────
  // The SDK's uploadFile(path) reads the file and calls:
  //   fetch(azureUrl, { method:'PUT', headers:{'x-ms-blob-type':'BlockBlob',...}, body: buffer })
  // Node's native fetch does NOT set Content-Length for a raw Buffer body —
  // it falls back to chunked transfer encoding. Azure BlockBlob silently accepts
  // the PUT but stores a 0-byte blob. Sarvam then fails with "Stream has ended".
  //
  // Fix: pass a Blob to uploadFile() instead of a file path. When fetch receives
  // a Blob body, Node.js automatically sets BOTH Content-Type (from blob.type)
  // AND Content-Length (from blob.size). Azure gets a semantically correct PUT.

  const blob = new Blob([safeBuffer], { type: mimeType });

  const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });

  // ── 1. Create job ────────────────────────────────────────────────────────────
  const job = await client.documentIntelligence.createJob({
    language:     'hi-IN',
    outputFormat: 'md',
  });

  // ── 2. Upload via Blob — SDK's uploadFile detects Blob, uses it as body,
  //       and fetch sets Content-Length + Content-Type automatically ──────────
  await job.uploadFile(blob);
  console.log(`[OCR] upload OK — jobId=${job.jobId}`);

  // ── 3. Start + wait ──────────────────────────────────────────────────────────
  await job.start();
  const status = await job.waitUntilComplete();
  console.log(`[OCR] job state=${status.job_state}`);

  if (status.job_state === 'Failed') {
    throw new Error(`Sarvam Vision job failed: ${JSON.stringify(status)}`);
  }

  // ── 4. Download output ZIP and extract markdown text ─────────────────────────
  const downloadResponse = await job.getDownloadLinks();
  const downloadUrls     = downloadResponse.download_urls;
  if (!downloadUrls || Object.keys(downloadUrls).length === 0) {
    throw new Error('Sarvam Vision: no download URLs available after completion.');
  }

  const downloadInfo = Object.values(downloadUrls)[0];
  if (!downloadInfo?.file_url) throw new Error('Sarvam Vision: invalid download URL response.');

  const zipResponse = await fetch(downloadInfo.file_url);
  if (!zipResponse.ok) throw new Error(`Sarvam Vision download failed [${zipResponse.status}]`);

  const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
  const zip       = new AdmZip(zipBuffer);
  const entries   = zip.getEntries();

  const textParts = entries
    .filter((e) => !e.isDirectory)
    .sort((a, b) => a.entryName.localeCompare(b.entryName))
    .map((e) => e.getData().toString('utf8').trim())
    .filter(Boolean);

  return { rawText: textParts.join('\n\n').trim() };
}

module.exports = { extractTextFromImage };


