const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function accessSecrets(secrets) {
  const client = new SecretManagerServiceClient();

  try {
    const promises = secrets.map(async (secretName) => {
      const [version] = await client.accessSecretVersion({ name: `projects/approvals-monitor/secrets/${secretName}/versions/latest` });
      const payload = version.payload.data.toString('utf8');
      return payload;
    });

    const secretValues = await Promise.all(promises);
    return secretValues;
  } catch (err) {
    console.error('Error accessing secrets:', err);
  }
}

module.exports = accessSecrets;