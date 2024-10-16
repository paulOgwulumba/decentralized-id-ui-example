import { COST_PER_BOX, COST_PER_BYTE, MAX_BOX_SIZE } from '@/constants/algo-did.constant';

/**
 * This calculates the total cost of uploading a given
 * DiD document to a smart contract.
 * @param documentBuffer Buffer containing the document to upload
 * @returns Total cost in micro algos
 */
export const calculateTotalCostOfUploadingDidDocument = (documentBuffer: Buffer) => {
  const ceilBoxes = Math.ceil(documentBuffer.byteLength / MAX_BOX_SIZE);

  const endBoxSize = documentBuffer.byteLength % MAX_BOX_SIZE;

  const totalCost =
    ceilBoxes * COST_PER_BOX + // cost of data boxes
    (ceilBoxes - 1) * MAX_BOX_SIZE * COST_PER_BYTE + // cost of data
    ceilBoxes * 8 * COST_PER_BYTE + // cost of data keys
    endBoxSize * COST_PER_BYTE + // cost of last data box
    COST_PER_BOX +
    (8 + 8 + 1 + 8 + 32 + 8) * COST_PER_BYTE; // cost of metadata box

  return { totalCost, numberOfBoxes: ceilBoxes, endBoxSize };
};
