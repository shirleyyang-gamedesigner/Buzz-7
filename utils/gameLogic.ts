
import { Player } from "../types";

/**
 * Checks if a number triggers the "Buzz" (Pass) condition.
 * Condition: Multiple of 7 OR Contains the digit '7'.
 */
export const isSevenCondition = (num: number): boolean => {
  if (num % 7 === 0) return true;
  if (num.toString().includes('7')) return true;
  return false;
};

export const getSafetyText = (num: number): string => {
  if (isSevenCondition(num)) return "过!";
  return num.toString();
};

/**
 * Generates the initial roster of players.
 * Player 0 is always the Human.
 */
export const generatePlayers = (count: number): Player[] => {
  // Pastel/C4D Style Colors
  const colors = [
    'from-[#FF9A9E] to-[#FECFEF]', // Pink
    'from-[#a18cd1] to-[#fbc2eb]', // Purple
    'from-[#84fab0] to-[#8fd3f4]', // Teal
    'from-[#ff9a9e] to-[#fecfef]', // Peach
    'from-[#e0c3fc] to-[#8ec5fc]', // Lavender
    'from-[#4facfe] to-[#00f2fe]', // Blue
    'from-[#43e97b] to-[#38f9d7]', // Green
    'from-[#fa709a] to-[#fee140]', // Orange/Yellow
  ];

  const animals = ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐮', '🐷', '🐸', '🐵'];
  
  // Cute Chinese Names
  const cuteNames = [
    "布丁", "团子", "汤圆", "奶茶", "可乐", 
    "年糕", "雪球", "泡芙", "曲奇", "果冻", 
    "棉花", "豆豆", "皮皮", "毛毛", "芝麻",
    "丸子", "波波", "咪咪", "旺财", "嘟嘟",
    "糯米", "奶酪", "布偶", "花卷", "烧卖"
  ];
  
  // Shuffle animals and names
  const shuffledAnimals = [...animals].sort(() => Math.random() - 0.5);
  const shuffledNames = [...cuteNames].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: i === 0 ? "你" : shuffledNames[i % shuffledNames.length],
    isAi: i !== 0,
    lives: 3,
    isEliminated: false,
    color: colors[i % colors.length],
    avatar: i === 0 ? '🧑‍🚀' : (shuffledAnimals[i % shuffledAnimals.length])
  }));
};

/**
 * Calculates CSS coordinates for circular layout.
 * Start angle puts index 0 at bottom (90 degrees / Math.PI/2).
 */
export const getCircularPosition = (index: number, total: number, radius: number) => {
  // We want index 0 at 90 degrees (Bottom).
  // The circle goes clockwise.
  const angle = (2 * Math.PI * index) / total + Math.PI / 2;
  
  // Math.cos/sin usually start from 3 o'clock (0 rads).
  // x = r * cos(angle), y = r * sin(angle)
  const x = Math.round(radius * Math.cos(angle));
  const y = Math.round(radius * Math.sin(angle));
  
  return { x, y };
};
