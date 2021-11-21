import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { PROVIDER_URL } from '../env';

const getParitySigRegistry = () => {
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
  const address = '0x44691B39d1a75dC4E0A0346CBB15E310e6ED1E86';
  const abi = [
    {
      constant: true,
      inputs: [{ name: '', type: 'bytes4' }],
      name: 'entries',
      outputs: [{ name: '', type: 'string' }],
      payable: false,
      type: 'function',
    },
  ];

  return new ethers.Contract(address, abi, provider);
};

export const useInputDecode = (functionData: string) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [method, setMethod] = useState<string>('CONTRACT INTERACTION');

  const getMethodFromOnChainRegistry = async (data: string) => {
    if (data === '0x') return 'SENDING ETH';

    const methodID = ethers.utils.hexDataSlice(data, 0, 4);
    const registry = getParitySigRegistry();

    return registry.entries(methodID);
  };

  useEffect(() => {
    const getMethod = async () => {
      setLoading(true);

      let method;
      try {
        method = await getMethodFromOnChainRegistry(
          functionData?.replace(/\s+/g, ''),
        );
      } catch (error) {
        console.log({ error });
      }

      if (method) {
        setMethod(
          method
            .split('(')[0]
            .replace(/([a-z](?=[A-Z]))/g, '$1 ')
            .toUpperCase(),
        );
      }
      setLoading(false);
    };

    if (functionData) {
      getMethod();
    }
  }, [functionData]);

  return { loading, method };
};
