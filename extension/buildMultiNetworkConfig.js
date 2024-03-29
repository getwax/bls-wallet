const fs = require('fs');
const path = require('path');

const networksConfigDir =
  process.env.NETWORKS_CONFIG_DIR ??
  path.join(__dirname, '..', 'contracts', 'networks');

fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });

const networkFilenames = fs.readdirSync(networksConfigDir);

const multiNetworkConfig = {};

for (const filename of networkFilenames) {
  if (!filename.endsWith('.json')) {
    throw new Error('Unexpected non-json file');
  }

  multiNetworkConfig[filename.slice(0, -'.json'.length)] = JSON.parse(
    fs.readFileSync(path.join(networksConfigDir, filename), 'utf-8'),
  );
}

fs.writeFileSync(
  path.join(__dirname, 'build', 'multiNetworkConfig.json'),
  JSON.stringify(multiNetworkConfig, null, 2),
);
