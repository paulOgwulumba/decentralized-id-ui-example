'use client';

import { useWallet } from '@txnlab/use-wallet-react';
import { AlgoDidClient } from '@/artifacts/algo-did-client';
import { useCallback } from 'react';
import { SendTransactionFrom } from '@algorandfoundation/algokit-utils/types/transaction';

export const useAlgoDidActions = () => {
  const { activeAddress, transactionSigner, algodClient, activeNetwork } = useWallet();

  const deploySmartContract = useCallback(async () => {
    if (!activeAddress || !transactionSigner || !algodClient) {
      throw new Error('No wallet connected');
    }

    console.log(activeNetwork);
    console.log(algodClient);

    const sender = { signer: transactionSigner, addr: activeAddress };

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
  }, [activeAddress, transactionSigner]);

  return { deploySmartContract };
};
