import { BasePostMessageStream } from '@toruslabs/openlogin-jrpc';
import { Duplex } from 'readable-stream';
import QuillInPageProvider from './InPageProvider';
import { ProviderOptions } from './interfaces';

interface InitializeProviderOptions extends ProviderOptions {
  /**
   * The stream used to connect to the wallet.
   */
  connectionStream: Duplex;

  /**
   * Whether the provider should be set as window.ethereum.
   */
  shouldSetOnWindow?: boolean;
}

export function initializeProvider({
  connectionStream,
  jsonRpcStreamName,
  maxEventListeners = 100,
  shouldSetOnWindow = true,
}: InitializeProviderOptions): QuillInPageProvider {
  const provider = new QuillInPageProvider(connectionStream, {
    jsonRpcStreamName,
    maxEventListeners,
  });

  const providerProxy = new Proxy(provider, {
    // some common libraries, e.g. web3@1.x, mess the api
    deleteProperty: () => true,
  });

  if (shouldSetOnWindow) {
    (window as unknown as Record<string, unknown>).ethereum = providerProxy;
    window.dispatchEvent(new Event('ethereum#initialized'));
  }

  return providerProxy;
}

// setup background connection
const metamaskStream = new BasePostMessageStream({
  name: 'quill-inpage',
  target: 'quill-contentscript',
});

initializeProvider({
  connectionStream: metamaskStream,
  // setting true will set window.ethereum to the provider
  shouldSetOnWindow: true,
});
