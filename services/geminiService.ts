import { GoogleGenAI } from "@google/genai";
import { AiCommentary } from "../types";

const apiKey = process.env.API_KEY || '';
// Initialize securely - if no key is present, the service will return fallback data
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateGameOverCommentary = async (score: number, reason: string): Promise<AiCommentary> => {
  if (!ai) {
    return {
      text: "游戏结束！别忘了设置API Key来解锁AI毒舌评价。",
      mood: 'neutral'
    };
  }

  const modelId = "gemini-2.5-flash";
  const prompt = `
    你是一个说话风趣、略带嘲讽的“逢七过”大逃杀游戏主持人。
    玩家刚刚结束了游戏。
    当前数字到达了: ${score}.
    结局: ${reason}.
    
    规则: 玩家围成一圈报数，遇到含7或7的倍数必须喊“过”。这是一场与AI机器人的大逃杀。
    
    请生成一句简短有力（20字以内）的中文评价。
    如果玩家获胜（是最后的幸存者），请予以夸奖。
    如果玩家被淘汰，请进行幽默的嘲讽或调侃。
    
    只返回纯文本。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    
    const text = response.text?.trim() || "下次好运！";
    return {
      text,
      mood: reason.toLowerCase().includes('win') || reason.toLowerCase().includes('victory') ? 'happy' : 'sarcastic'
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      text: "我的CPU烧干了，但你打得不错！",
      mood: 'neutral'
    };
  }
};