const { S3Client } = require("@aws-sdk/client-s3");

function getR2Client() {
  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_REGION,
    R2_ENDPOINT,
  } = process.env;

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    throw new Error("R2 env vars ausentes (ACCESS/SECRET/ENDPOINT)");
  }

  return new S3Client({
    region: R2_REGION || "auto",
    endpoint: R2_ENDPOINT, // https://<accountid>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,

    requestChecksumCalculation: "NEVER",
    responseChecksumValidation: "NEVER",
  });
}

module.exports = { getR2Client };
