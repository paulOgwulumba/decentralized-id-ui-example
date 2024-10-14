'use client';

import { WalletProvider } from '@txnlab/use-wallet-react';
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet';
import { useRecoilState } from 'recoil';
import { ConnectWalletVisibleAtom } from '@/state';
import { WalletConnectModal } from '@/components/wallet-connect-modal';

interface Props {
  children: React.ReactNode;
}

export const WalletConnectProvider = ({ children }: Props) => {
  const [connectWalletVisible, setConnectWalletVisible] = useRecoilState(ConnectWalletVisibleAtom);
  const walletManager = new WalletManager({
    wallets: [WalletId.DEFLY, WalletId.PERA, WalletId.EXODUS, WalletId.KIBISIS],
    network:
      process.env.NEXT_PUBLIC_ENVIRONMENT === 'production'
        ? NetworkId.MAINNET
        : process.env.NEXT_PUBLIC_ENVIRONMENT === 'local'
        ? NetworkId.LOCALNET
        : NetworkId.TESTNET,
  });

  return (
    <WalletProvider manager={walletManager}>
      {connectWalletVisible && (
        <WalletConnectModal onClose={() => setConnectWalletVisible(false)} />
      )}
      {children}
    </WalletProvider>
  );
};
