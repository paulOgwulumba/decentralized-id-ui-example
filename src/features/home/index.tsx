'use client';

import { AlgorandIcon } from '@/assets';
import { ConnectWalletVisibleAtom } from '@/state';
import { useWallet } from '@txnlab/use-wallet-react';
import styles from './index.module.scss';
import { useSetRecoilState } from 'recoil';

export const Home = () => {
  const setConnectWallet = useSetRecoilState(ConnectWalletVisibleAtom);
  const { activeAddress, activeWallet } = useWallet();

  return (
    <div className={styles.container}>
      <main>
        <AlgorandIcon className={styles.AlgorandIcon} />
        <ul>
          <li>Welcome to the Next.JS Template for Algorand.</li>
          <li>
            {activeAddress
              ? `Your wallet address is: ${activeAddress}`
              : `Get started by connecting your wallet.`}
          </li>
        </ul>

        <div className={styles['button-group']}>
          <button
            onClick={() => {
              if (activeWallet) {
                activeWallet?.disconnect();
              } else {
                setConnectWallet(true);
              }
            }}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            {activeAddress ? 'Disconnect Wallet' : 'Connect Wallet'}
          </button>
        </div>
      </main>
    </div>
  );
};
