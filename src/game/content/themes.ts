import { message, type TextRef } from '../i18n/messages.ts';
// Themes describe presentation only. No depth, ore weights, economy or Three.js objects.
export type Theme = Readonly<{ id: string; name: TextRef; motif: string; rock: string; floor: string; accent: string; wood: string; sky: string; groundLight: string }>;
export const THEMES: readonly Theme[] = Object.freeze([
  { id:'meadow_mine', name:message("msg.emerald_valley"), motif:'meadow', rock:'#a3b6b9', floor:'#76b454', accent:'#ffd66e', wood:'#906044', sky:'#b8deeb', groundLight:'#b8d2c4' },
  { id:'timber_mine', name:message("msg.old_mine"), motif:'timber', rock:'#7e817c', floor:'#8a8070', accent:'#ffc778', wood:'#805a3e', sky:'#414e55', groundLight:'#888172' },
  { id:'mushroom_cave', name:message("msg.mushroom_cave"), motif:'mushroom', rock:'#738f8e', floor:'#668d7b', accent:'#97e2c5', wood:'#55576c', sky:'#3c6062', groundLight:'#6c8b84' },
  { id:'crystal_cave', name:message("msg.crystal_cave"), motif:'crystal', rock:'#7c83a3', floor:'#7c849b', accent:'#b9b2fb', wood:'#555e82', sky:'#4f5578', groundLight:'#8185a2' },
  { id:'buried_ruins', name:message("msg.buried_ruins"), motif:'ruins', rock:'#bca582', floor:'#b5a384', accent:'#9ed8c6', wood:'#787465', sky:'#756957', groundLight:'#aba08b' },
  { id:'frozen_cave', name:message("msg.frozen_mine"), motif:'ice', rock:'#96c4d1', floor:'#94b7c3', accent:'#dcf5f4', wood:'#64899b', sky:'#637f94', groundLight:'#98b1bf' },
  { id:'lava_cave', name:message("msg.lava_mine"), motif:'lava', rock:'#65616a', floor:'#6d6262', accent:'#f2a267', wood:'#494a55', sky:'#634e50', groundLight:'#9c7c70' },
  { id:'fossil_cave', name:message("msg.giant_fossils"), motif:'fossil', rock:'#ac8775', floor:'#ac8c78', accent:'#ecd9ae', wood:'#74534b', sky:'#71595c', groundLight:'#ad9480' },
  { id:'ancient_machine', name:message("msg.ancient_machines"), motif:'machine', rock:'#7e959c', floor:'#81979d', accent:'#7ae1d0', wood:'#475c64', sky:'#415c68', groundLight:'#839b9c' },
  { id:'core_sanctum', name:message("msg.core_sanctum"), motif:'core', rock:'#787e99', floor:'#7d8297', accent:'#f5da9b', wood:'#535671', sky:'#474d70', groundLight:'#8d87a0' },
].map(t => Object.freeze(t)));
const themes = new Map(THEMES.map(t => [t.id,t]));
export function themeById(id: string) { const t=themes.get(id); if(!t) throw new Error(`未知主题 ${id}`); return t; }
