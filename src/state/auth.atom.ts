import { Token } from '@/interface';
import { atom } from 'recoil';

export const authAtom = atom<Token | null>({
  default: null,
  key: 'auth-atom',
});
