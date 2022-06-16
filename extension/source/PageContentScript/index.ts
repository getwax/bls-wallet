import * as io from 'io-ts';

// import { BasePostMessageStream } from '@toruslabs/openlogin-jrpc';
// import type { Duplex } from 'readable-stream';
// import { CONTENT_SCRIPT, INPAGE } from '../common/constants';
// import { QuillInPageProvider } from './InPageProvider';
// import { ProviderOptions } from './interfaces';
import QuillProvider from './QuillProvider';

// interface InitializeProviderOptions extends ProviderOptions {
//   /**
//    * The stream used to connect to the wallet.
//    */
//   connectionStream: Duplex;

//   /**
//    * Whether the provider should be set as window.ethereum.
//    */
//   shouldSetOnWindow?: boolean;
// }

export function initializeProvider({
  // connectionStream,
  // jsonRpcStreamName,
  // maxEventListeners = 100,
  shouldSetOnWindow = true,
}: {
  shouldSetOnWindow?: boolean;
}) {
  const RequestBody = io.type({
    method: io.string,
    params: io.union([io.undefined, io.array(io.unknown)]),
  });

  const provider = new QuillProvider();

  // const provider = new QuillInPageProvider(connectionStream, {
  //   jsonRpcStreamName,
  //   maxEventListeners,
  // });

  const providerProxy = new Proxy(provider, {
    // some common libraries, e.g. web3@1.x, mess the api
    deleteProperty: () => true,
  });

  if (shouldSetOnWindow) {
    (window as unknown as Record<string, unknown>).ethereum = providerProxy;
    window.dispatchEvent(new Event('ethereum#initialized'));
  }

  // return providerProxy;
}

// setup background connection
// const quillStream = new BasePostMessageStream({
//   name: INPAGE,
//   target: CONTENT_SCRIPT,
// });

initializeProvider({
  // connectionStream: quillStream,
  // setting true will set window.ethereum to the provider
  shouldSetOnWindow: true,
});
