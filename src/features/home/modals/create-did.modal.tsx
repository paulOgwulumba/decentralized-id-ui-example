'use client';

import { BackgroundOverlay } from '@/components/background-overlay';
import styles from './index.module.scss';
import { useId, useState } from 'react';
import { useAlgoDidActions } from '@/actions/algo-did';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export const CreateDidModal = ({ onClose }: Props) => {
  const [appId, setAppId] = useState('');
  const { createDidDocument, uploadDidDocument } = useAlgoDidActions();

  const onCreateDoc = async () => {
    try {
      const doc = await createDidDocument({ appId });
      toast.loading('Uploading document...');
      const res = await uploadDidDocument({ document: doc, appId });
      console.log(res);
      toast.dismiss();
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(`Failed to create DID: ${error}`);
    }
  };

  return (
    <BackgroundOverlay onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.title}>
          <h4>Create a DID</h4>
        </div>
        <div className={styles.content}>
          <div className={styles.form_control}>
            <label>App ID</label>
            <input type="number" value={appId} onChange={(evt) => setAppId(evt.target.value)} />
          </div>

          <button
            onClick={() => onCreateDoc()}
            disabled={!appId}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Create DiD
          </button>
        </div>
      </div>
    </BackgroundOverlay>
  );
};
