const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v1: uuid } = require('uuid');
const keys = require('../config/keys');
const requireLogin = require('../middlewares/requireLogin');

const client = new S3Client({
  credentials: {
    accessKeyId: keys.accessKeyId,
    secretAccessKey: keys.secretAccessKey,
  },
  region: keys.region,
});

module.exports = (app) => {
  app.get('/api/upload', requireLogin, async (req, res) => {
    try {
      const key = `${req.user.id}/${uuid()}.jpeg`;

      const command = new PutObjectCommand({
        Bucket: keys.bucket,
        Key: key,
        ContentType: 'image/jpeg',
        ChecksumAlgorithm: undefined,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: 3600,
      });

      res.send({ key, url });
    } catch (err) {
      console.error('S3 error:', err);
      res.status(500).send('Failed to generate signed URL');
    }
  });
};
