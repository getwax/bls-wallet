import { ethers } from 'ethers';
import QuillEthereumProvider from './QuillEthereumProvider';

/**
 * QuillEthereumProvider implements `ethers.providers.ExternalProvider` but
 * TypeScript doesn't see it that way because we provide more accurate type
 * information.
 *
 * This method is here to allow you to easily make an ethers provider from
 * QuillEthereumProvider.
 */
export default function EthersProvider(
  quillEthereumProvider: QuillEthereumProvider,
) {
  return new ethers.providers.Web3Provider(
    quillEthereumProvider as ethers.providers.ExternalProvider,
  );
}
