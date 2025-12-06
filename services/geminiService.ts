import { Visit } from "../types";

// OpenAI GPT용 API 키 (Vite 환경변수)
const OPENAI_API_KEY =
  (import.meta as any).env?.VITE_OPENAI_API_KEY ||
  (import.meta as any).env?.OPENAI_API_KEY ||
  "";

export const analyzeTraffic = async (visits: Visit[]): Promise<string> => {
  if (!OPENAI_API_KEY) {
    return "GPT API Key가 설정되지 않았습니다. 관리자에게 문의하세요.";
  }

  // Filter for last 24 hours to keep context small and relevant
  const recentVisits = visits.slice(0, 50).map(v => ({
    time: new Date(v.check_in_at).toLocaleTimeString('ko-KR'),
    duration: v.check_out_at 
      ? Math.round((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000) + '분'
      : '진행 중',
    purpose: v.purpose,
  }));

  const prompt = `
다음은 청년 공간(공유 오피스, 코워킹 스페이스 등)의 방문자 로그 데이터입니다.
데이터: ${JSON.stringify(recentVisits)}

이 데이터를 바탕으로 운영진을 위한 한국어 인사이트 리포트를 작성해주세요.
다음 3가지 항목을 포함하여, 간결하게(Plain text, Markdown 사용 금지) 작성해 주세요.

1. 주요 혼잡 시간대 및 트렌드
2. 방문자들이 주로 이용하는 목적
3. 운영진을 위한 실질적인 조언 (예: "오후 2시경에 인력을 보강하세요")

말투는 "합니다" 체로 정중하고 전문적으로 작성해주세요.
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 청년 공간 운영자를 돕는 데이터 분석 어시스턴트입니다. 답변은 항상 한국어로, 깔끔한 문장 위주로 작성합니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API HTTP error", response.status, await response.text());
      return "현재 GPT 분석 서비스를 이용할 수 없습니다.";
    }

    const data: any = await response.json();
    const text =
      data?.choices?.[0]?.message?.content?.toString().trim() ??
      "인사이트를 생성할 수 없습니다.";
    return text;
  } catch (error) {
    console.error("OpenAI GPT API Error:", error);
    return "현재 GPT 분석 서비스를 이용할 수 없습니다.";
  }
};
