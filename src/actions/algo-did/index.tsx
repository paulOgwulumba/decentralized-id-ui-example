'use client';

import { useWallet } from '@txnlab/use-wallet';
import { AlgoDidClient } from '@/artifacts/algo-did-client';
import { useCallback } from 'react';
import { getAlgodClient } from '@/utils/get-algo-client-config';

export const useAlgoDidActions = () => {
  const { activeAddress, signer } = useWallet();

  const deploySmartContract = useCallback(async () => {
    if (!activeAddress || !signer) {
      throw new Error('No wallet connected');
    }

    const sender = { signer, addr: activeAddress };
    const algodClient = getAlgodClient();

    const appClient = new AlgoDidClient(
      {
        resolveBy: 'id',
        id: 0,
        sender,
      },
      algodClient,
    );

    const response = await appClient.create.createApplication({}, {});
    console.log(response);
    console.log('Smart contract deployed with ID:', response);

    return response;
  }, [activeAddress, signer]);

  return { deploySmartContract };
};
