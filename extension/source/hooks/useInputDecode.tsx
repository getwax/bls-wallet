import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import axios from 'axios';

import { useQuill } from '../QuillContext';

const getMethodFromRegistry = async (data: string) => {
  if (data === '0x') return { funcSig: 'SENDING ETH', args: [] };

  const funcSigHex = data.slice(0, 10);

  const res = await axios.get(
    `https://sig.eth.samczsun.com/api/v1/signatures?all=true&function=${funcSigHex}`,
  );
  const funcSig = res.data.result.function[funcSigHex][0].name;
  const iface = new ethers.utils.Interface([`function ${funcSig}`]);
  const { args } = iface.parseTransaction({ data });

  return { funcSig, args };
};

type UseInputDecodeValues = {
  loading: boolean;
  method: string;
  args: ethers.utils.Result;
};

export const useInputDecode = (functionData: string): UseInputDecodeValues => {
  const quill = useQuill();

  const [loading, setLoading] = useState<boolean>(true);
  const [method, setMethod] = useState<string>('CONTRACT INTERACTION');
  const [allArgs, setAllArgs] = useState<ethers.utils.Result>([]);

  useEffect(() => {
    const getMethod = async () => {
      setLoading(true);

      const data = functionData?.replace(/\s+/g, '');
      const { funcSig, args } = await getMethodFromRegistry(data);
      setMethod(funcSig);
      setAllArgs(args);

      setLoading(false);
    };

    if (functionData) {
      getMethod();
    }
  }, [functionData, quill]);

  return { loading, method, args: allArgs };
};
