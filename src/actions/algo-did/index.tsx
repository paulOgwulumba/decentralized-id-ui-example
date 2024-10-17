'use client';

import { useWallet } from '@txnlab/use-wallet';
import { AlgoDidClient } from '@/artifacts/algo-did-client';
import algosdk from 'algosdk';
import { useCallback } from 'react';
import { getAlgoClientConfig, getAlgodClient } from '@/utils/get-algo-client-config';
import { CreateDiDDocumentDto, DidDocument, UploadDiDDocumentDto } from '@/interface/did.interface';
import { calculateTotalCostOfUploadingDidDocument } from '@/utils/algo-did-utils';

export const useAlgoDidActions = () => {
  const { activeAddress, signer } = useWallet();
  const { config } = getAlgoClientConfig();
  const algodClient = getAlgodClient();

  const deploySmartContract = useCallback(async () => {
    if (!activeAddress || !signer) {
      throw new Error('No wallet connected');
    }

    const sender = { signer, addr: activeAddress };

    const appClient = new AlgoDidClient(
      {
        resolveBy: 'id',
        id: 0,
        sender,
      },
      algodClient,
    );

    const response = await appClient.create.createApplication({}, {});

    return response;
  }, [activeAddress, signer]);

  const createDidDocument = useCallback(
    async ({ appId }: CreateDiDDocumentDto) => {
      if (!activeAddress || !signer) {
        throw new Error('No wallet connected');
      }

      // Get wallet address public key
      const publicKey = algosdk.decodeAddress(activeAddress).publicKey;
      const publicKeyHex = Buffer.from(publicKey).toString('hex');

      // Generate the base identifier (DID)
      const subject = `${config.algod.network}:app:${appId}:${publicKeyHex}`;
      const did = `did:algo:${subject}`;

      const didDocument: DidDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1',
          'https://w3id.org/security/suites/x25519-2020/v1',
        ],
        id: did,
        verificationMethod: [
          {
            id: `${did}#master`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
          },
        ],
        authentication: [`${did}#master`],

        // Add custom metadata like the username or email
        service: [
          {
            id: `${did}#username`,
            type: 'UserProfile',
            serviceEndpoint: { username: 'alice' },
          },
          {
            id: `${did}#email`,
            type: 'UserEmail',
            serviceEndpoint: { email: 'alice@gmail.org' },
          },
        ],
      };

      return didDocument;
    },
    [activeAddress, signer],
  );

  const startDidDocumentUpload = useCallback(
    async ({ document, appId }: UploadDiDDocumentDto) => {
      if (!activeAddress || !signer) {
        throw new Error('No wallet connected');
      }

      const documentBuffer = Buffer.from(JSON.stringify(document));
      const sender = { signer, addr: activeAddress };

      const appClient = new AlgoDidClient(
        {
          resolveBy: 'id',
          id: Number(appId),
          sender,
        },
        algodClient,
      );

      const { totalCost, numberOfBoxes, endBoxSize } =
        calculateTotalCostOfUploadingDidDocument(documentBuffer);
      const appAddress = (await appClient.appClient.getAppReference()).appAddress;
      const publicKey = algosdk.decodeAddress(activeAddress).publicKey;

      const mbrPayment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: sender.addr,
        to: appAddress,
        amount: totalCost,
        suggestedParams: await algodClient.getTransactionParams().do(),
      });

      const response = await appClient.startUpload(
        {
          pubKey: activeAddress,
          numBoxes: numberOfBoxes,
          endBoxSize: endBoxSize,
          mbrPayment,
        },
        {
          sendParams: {
            suppressLog: true,
          },
          boxes: [
            {
              appIndex: Number(appId),
              name: publicKey,
            },
          ],
        },
      );

      return response;
    },
    [activeAddress, signer],
  );

  const uploadDidDocument = useCallback(
    async ({ document, appId }: UploadDiDDocumentDto) => {
      if (!activeAddress || !signer) {
        throw new Error('No wallet connected');
      }

      const documentBuffer = Buffer.from(JSON.stringify(document));
      const sender = { signer, addr: activeAddress };
      const publicKey = algosdk.decodeAddress(activeAddress).publicKey;

      const appClient = new AlgoDidClient(
        {
          resolveBy: 'id',
          id: Number(appId),
          sender,
        },
        algodClient,
      );

      const boxIndices = (await appClient.appClient.getBoxValueFromABIType(
        activeAddress,
        algosdk.ABIType.from('(uint64, uint64, uint8, uint64)'),
      )) as number[];

      const metadata = {
        start: boxIndices[0],
        end: boxIndices[1],
        status: boxIndices[2],
        endSize: boxIndices[3],
      };

      console.log(metadata);
      console.log(boxIndices);
    },
    [activeAddress, signer],
  );

  return {
    deploySmartContract,
    createDidDocument,
    startDidDocumentUpload,
    uploadDidDocument,
  };
};
