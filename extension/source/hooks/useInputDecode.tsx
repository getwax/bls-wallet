import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { PROVIDER_URL } from '../env';
import axios from 'axios';

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

const getMethodFromOnChainRegistry = async (data: string) => {
  if (data === '0x') return 'SENDING ETH';

  const methodID = ethers.utils.hexDataSlice(data, 0, 4);
  const registry = getParitySigRegistry();

  return registry.entries(methodID);
};

const getMethodFromEtherscan = async (to: string, data: string) => {
  const res = await axios.get(
    `https://api.etherscan.io/api?module=contract&action=getabi&address=${to}`,
  );

  if (res.data.result !== 'Contract source code not verified') {
    const iface = new ethers.utils.Interface(res.data.result);
    return iface.parseTransaction({ data, value: 1 }).name;
  }

  throw 'Unverified Contract';
};

const formatMethod = (method: string) => {
  return method
    .split('(')[0]
    .replace(/([a-z](?=[A-Z]))/g, '$1 ')
    .toUpperCase();
};

export const useInputDecode = (functionData: string, to: string) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [method, setMethod] = useState<string>('CONTRACT INTERACTION');

  useEffect(() => {
    const getMethod = async () => {
      setLoading(true);

      const data = functionData?.replace(/\s+/g, '');

      let method;
      try {
        method = await getMethodFromOnChainRegistry(data);
        if (!method) {
          method = await getMethodFromEtherscan(to, data);
        }
      } catch (error) {
        console.log({ error });
      }

      if (method) {
        setMethod(formatMethod(method));
      }
      setLoading(false);
    };

    if (functionData) {
      getMethod();
    }
  }, [functionData]);

  return { loading, method };
};
