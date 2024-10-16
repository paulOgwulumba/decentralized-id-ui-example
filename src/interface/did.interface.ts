export interface CreateDiDDocumentDto {
  appId: string;
}

export interface DidDocument {
  '@context': string[];
  id: string;
  verificationMethod: {
    id: string;
    type: string;
    controller: string;
  }[];
  authentication: string[];
  service: {
    id: string;
    type: string;
    serviceEndpoint: Record<string, string>;
  }[];
}
