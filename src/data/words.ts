import { easyWords } from './words_easy';
import { mediumWords } from './words_medium';
import { hardWords } from './words_hard';
import { extraEasyWords, extraMediumWords } from './words_extra';

// Объединяем все слова по категориям
export const allEasyWords: string[] = [...new Set([...easyWords, ...extraEasyWords])];
export const allMediumWords: string[] = [...new Set([...mediumWords, ...extraMediumWords])];
export const allHardWords: string[] = [...new Set([...hardWords])];

// Экспортируем для совместимости
export { easyWords, mediumWords, hardWords };

export function getWordsForDifficulty(difficulty: 'easy' | 'medium' | 'hard'): string[] {
  let pool: string[] = [];

  if (difficulty === 'easy') {
    pool = [...allEasyWords];
  } else if (difficulty === 'medium') {
    // Основа — средние слова (3x), добавляем ~15% лёгких
    pool = [...allMediumWords, ...allMediumWords, ...allMediumWords];
    const easyCount = Math.floor(allEasyWords.length * 0.15);
    const easySubset = [...allEasyWords].sort(() => Math.random() - 0.5).slice(0, easyCount);
    pool = [...pool, ...easySubset];
  } else {
    // Основа — сложные слова (3x), добавляем ~8% средних
    pool = [...allHardWords, ...allHardWords, ...allHardWords];
    const medCount = Math.floor(allMediumWords.length * 0.08);
    const medSubset = [...allMediumWords].sort(() => Math.random() - 0.5).slice(0, medCount);
    pool = [...pool, ...medSubset];
  }

  // Перемешиваем
  return pool.sort(() => Math.random() - 0.5);
}
