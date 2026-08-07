import type { CharacterDefinition } from '../domain/project';

export const mockCharacters: CharacterDefinition[] = [
  { id: 'merchant', name: '상인', emoji: '🧑‍💼', expressions: ['기본', '기쁨', '화남'] },
  { id: 'warrior', name: '전사', emoji: '🗡️', expressions: ['기본', '결의', '놀람'] },
  { id: 'mage', name: '마법사', emoji: '🧙', expressions: ['기본', '기쁨', '슬픔'] },
  { id: 'guard', name: '수호자', emoji: '🛡️', expressions: ['기본', '경계', '화남'] },
  { id: 'king', name: '왕', emoji: '👑', expressions: ['기본', '엄숙', '기쁨'] },
];
