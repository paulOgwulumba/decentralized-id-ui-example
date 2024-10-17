'use client';

import { useWallet } from '@txnlab/use-wallet';
import { AlgoDidClient } from '@/artifacts/algo-did-client';
import algosdk from 'algosdk';
import { useCallback } from 'react';
import { getAlgoClientConfig, getAlgodClient } from '@/utils/get-algo-client-config';
import {
  CreateDiDDocumentDto,
  DidDocument,
  DidMetadata,
  MassUploadChunksDto,
  UploadDiDDocumentDto,
  UploadDidBoxDto,
} from '@/interface/did.interface';
import { calculateTotalCostOfUploadingDidDocument } from '@/utils/algo-did-utils';
import { BYTES_PER_CALL, MAX_BOX_SIZE } from '@/constants/algo-did.constant';

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
        publicKey,
        algosdk.ABIType.from('(uint64,uint64,uint8,uint64,uint64)'),
      )) as BigInt[];

      const metadata = {
        start: boxIndices[0],
        end: boxIndices[1],
        status: boxIndices[2],
        endSize: boxIndices[3],
      };

      const numOfBoxes = Math.floor(documentBuffer.byteLength / MAX_BOX_SIZE);
      const boxData: Buffer[] = [];

      for (let i = 0; i < numOfBoxes; i++) {
        const box = documentBuffer.subarray(i * MAX_BOX_SIZE, (i + 1) * MAX_BOX_SIZE);
        boxData.push(box);
      }

      const lastBox = documentBuffer.subarray(numOfBoxes * MAX_BOX_SIZE, documentBuffer.byteLength);
      boxData.push(lastBox);

      if (Buffer.concat(boxData).toString('hex') !== documentBuffer.toString('hex')) {
        throw new Error('Box data does not match the document');
      }

      const txIds: string[] = [];

      for (let boxIndexOffset = 0; boxIndexOffset < boxData.length; boxIndexOffset++) {
        const box = boxData[boxIndexOffset];

        const newRes = await uploadDidBox({
          box,
          boxIndexOffset: boxIndexOffset,
          metadata,
          appId: Number(appId),
          algoDidClient: appClient,
          sender,
          publicKey,
        });

        txIds.push(...newRes);
      }

      return { txIds };
    },
    [activeAddress, signer],
  );

  const uploadDidBox = useCallback(async (dto: UploadDidBoxDto) => {
    const { box, boxIndexOffset, metadata, appId, algoDidClient, sender, publicKey } = dto;

    const boxIndex = BigInt(Number(metadata.start) + boxIndexOffset);
    const numOfChunks = Math.ceil(box.byteLength / BYTES_PER_CALL);

    const chunks: Buffer[] = [];

    for (let i = 0; i < numOfChunks; i += 1) {
      chunks.push(box.subarray(i * BYTES_PER_CALL, (i + 1) * BYTES_PER_CALL));
    }

    const boxRef = { appIndex: Number(appId), name: algosdk.encodeUint64(boxIndex) };
    const boxes: algosdk.BoxReference[] = new Array(7).fill(boxRef);
    boxes.push({ appIndex: Number(appId), name: publicKey });

    const firstGroup = chunks.slice(0, 8);
    const secondGroup = chunks.slice(8);

    const res = await massUploadChunks({
      chunks: firstGroup,
      boxIndex: Number(boxIndex),
      boxes,
      appId,
      algoDidClient,
      sender,
      publicKey,
      bytesOffset: 0,
    });

    if (secondGroup.length === 0) return res.txIDs;

    const res2 = await massUploadChunks({
      chunks: secondGroup,
      boxIndex: Number(boxIndex),
      boxes,
      appId,
      algoDidClient,
      sender,
      publicKey,
      bytesOffset: 8,
    });

    return [...res.txIDs, ...res2.txIDs];
  }, []);

  const massUploadChunks = useCallback(async (dto: MassUploadChunksDto) => {
    const { chunks, boxIndex, boxes, appId, algoDidClient, sender, publicKey, bytesOffset } = dto;

    const atc = new algosdk.AtomicTransactionComposer();
    const abiMethod = algoDidClient.appClient.getABIMethod('upload');
    const suggestedParams = await algodClient.getTransactionParams().do();

    chunks.forEach((chunk, index) => {
      atc.addMethodCall({
        method: abiMethod!,
        methodArgs: [publicKey, boxIndex, BYTES_PER_CALL * (index + bytesOffset), chunk],
        boxes,
        suggestedParams,
        sender: sender.addr,
        signer: sender.signer,
        appID: Number(appId),
      });
    });

    return atc.execute(algodClient, 3);
  }, []);

  const getDidMetaData = useCallback(async (appId: string) => {
    if (!activeAddress || !signer) {
      throw new Error('No wallet connected');
    }

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
      publicKey,
      algosdk.ABIType.from('(uint64,uint64,uint8,uint64,uint64)'),
    )) as BigInt[];

    const metadata: DidMetadata = {
      start: boxIndices[0],
      end: boxIndices[1],
      status: boxIndices[2],
      endSize: boxIndices[3],
    };

    return metadata;
  }, []);

  const finishDidDocumentUpload = useCallback(
    async (appId: string) => {
      if (!activeAddress || !signer) {
        throw new Error('No wallet connected');
      }

      const sender = { signer, addr: activeAddress };

      const appClient = new AlgoDidClient(
        {
          resolveBy: 'id',
          id: Number(appId),
          sender,
        },
        algodClient,
      );

      const publicKey = algosdk.decodeAddress(activeAddress).publicKey;

      const response = await appClient.finishUpload(
        {
          pubKey: activeAddress,
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

  return {
    deploySmartContract,
    createDidDocument,
    startDidDocumentUpload,
    uploadDidDocument,
    getDidMetaData,
    finishDidDocumentUpload,
  };
};
