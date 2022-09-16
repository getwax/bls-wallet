import assert from '../helpers/assert';
import { MultiNetworkConfig } from '../MultiNetworkConfig';
import { QuillState } from '../QuillStorageCells';

export default function getNetworkConfig(
  network: QuillState<'network'>,
  multiNetworkConfig: MultiNetworkConfig,
) {
  const networkConfig = multiNetworkConfig[network.networkKey];

  assert(
    networkConfig !== undefined,
    () => new Error(`network config not found for ${network.displayName}`),
  );

  return networkConfig;
}
