import { mkdir, writeFile } from 'node:fs/promises';

const rawFingerprint = process.env.ANDROID_CERT_SHA256?.trim();
if (!rawFingerprint) {
  throw new Error('ANDROID_CERT_SHA256 is required to generate assetlinks.json');
}

const compact = rawFingerprint.replace(/:/g, '').toUpperCase();
if (!/^[0-9A-F]{64}$/.test(compact)) {
  throw new Error('ANDROID_CERT_SHA256 must contain exactly 32 SHA-256 bytes');
}
const fingerprint = compact.match(/.{2}/g).join(':');

const payload = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'be.carouan.tecwidget',
      sha256_cert_fingerprints: [fingerprint],
    },
  },
];

await mkdir('dist/.well-known', { recursive: true });
await writeFile('dist/.well-known/assetlinks.json', `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Generated dist/.well-known/assetlinks.json for ${fingerprint}`);
