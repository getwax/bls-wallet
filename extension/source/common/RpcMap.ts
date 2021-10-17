type RpcMap = {
  eth_sendTransaction: {
    params: [
      {
        nonce?: string;
        gasPrice?: string;
        gas?: string;
        to?: string;
        from?: string;
        value?: string;
        data?: string;
        chainId?: string;
      },
    ];
    result: string;
  };
  add: {
    params: [number, number];
    result: number;
  };
};

export default RpcMap;
