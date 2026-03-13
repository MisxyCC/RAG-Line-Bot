import knowledgeBase from './optimized_knowledge.json';

export interface Env {
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  GEMINI_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-line-signature');
    const bodyText = await request.text();

    if (!signature) {
      return new Response('Bad Request', { status: 400 });
    }

    // 1. ตรวจสอบ LINE Signature เพื่อความปลอดภัย
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.LINE_CHANNEL_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureBase64 = btoa(String.fromCharCode.apply(null, signatureArray));

    if (signature !== signatureBase64) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(bodyText);
    const events = body.events;

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        const rawUserText = event.message.text;

        // --- ส่วนที่ 1: ดักจับคำเรียกชื่อ (Trigger Words) ---
        // รองรับ @bot, @Bot, @BOT และ @พลทหาร
        const triggerRegex = /@(bot|พลทหาร)/i;

        // ถ้าไม่มีคำเรียกบอตในข้อความ ให้ข้าม (Ignore) การทำงานไปเลย
        if (!triggerRegex.test(rawUserText)) {
          continue;
        }

        // --- ส่วนที่ 2: เตรียมข้อความก่อนส่งให้ AI ---
        // ตัดคำว่า @bot หรือ @พลทหาร ออกจากข้อความ และลบช่องว่างหัวท้าย
        const userText = rawUserText.replace(triggerRegex, '').trim();

        let aiReplyText = '';

        // ดักเผื่อกรณีผู้ใช้พิมพ์มาแค่ "@พลทหาร" เฉยๆ แล้วยังไม่ได้ถามอะไร
        if (userText === '') {
            aiReplyText = 'มีอะไรให้พลทหารช่วยเหลือเกี่ยวกับระบบ PEA Life พิมพ์คำถามต่อท้ายมาได้เลยครับ';
        } else {
            // --- ส่วนที่ 3: กระบวนการเรียก Gemini API (ทำเมื่อมีคำถามเท่านั้น) ---
            const prompt = `
              คุณคือ "ผู้ช่วยผู้เชี่ยวชาญระบบ PEA Life" หน้าที่ของคุณคือตอบคำถามพนักงานเกี่ยวกับการใช้งานระบบ ล่วงเวลา (OT/OTD) การเดินทาง (TD) และการลา

              คุณเป็นคนที่ตรวจสอบข้อมูลอย่างรอบคอบมาก และยึดถือข้อมูลจากคู่มือที่กำหนดให้เป็นความจริงสูงสุดเพียงแหล่งเดียว

              [ข้อมูลคู่มือระบบ]
              ${JSON.stringify(knowledgeBase)}

              [กฎเหล็กในการตอบคำถามที่คุณต้องปฏิบัติตามอย่างเคร่งครัด]
              1. ห้ามคิดไปเอง (Zero Hallucination): ตอบคำถามโดยอ้างอิงจาก [ข้อมูลคู่มือระบบ] เท่านั้น หากผู้ใช้ถามเรื่องที่ไม่มีในข้อมูล ให้ตอบอย่างสุภาพว่า "ขออภัยครับ ไม่พบข้อมูลในคู่มือเบื้องต้น กรุณาติดต่อ Service Desk โทร 9960 ครับ" ห้ามพยายามเดาคำตอบเด็ดขาด
              2. ตั้งข้อสงสัยเมื่อข้อมูลไม่พอ (Clarify Ambiguity): หากคำถามกว้างเกินไป เช่น ถามแค่ว่า "ยกเลิกยังไง" หรือ "ติดต่อใคร" คุณต้องถามกลับเพื่อระบุบริบทให้ชัดเจนก่อน เช่น "ต้องการยกเลิกใบงาน OT (OTD) หรือยกเลิกวันลาพักผ่อนครับ?"
              3. ความแม่นยำของข้อมูลติดต่อ (Contact Precision): ระวังเรื่องเบอร์ติดต่อเป็นพิเศษ
                - หากเป็นเรื่อง OT/TD/ลบใบงาน/ย้อนสถานะ ต้องแนะนำให้ติดต่อ ผบก.กสข. (10964, 10965)
                - หากเป็นเรื่องระบบล่ม/เข้าระบบไม่ได้/ลืมรหัส ให้ติดต่อ Service Desk (9960)
                - ห้ามให้เบอร์ติดต่อสลับบริบทกันเด็ดขาด
              4. รูปแบบการตอบ (LINE Formatting): เนื่องจากแสดงผลบน LINE Chat
                - สรุปคำตอบให้กระชับ ตรงประเด็น ไม่ต้องเกริ่นนำยาว
                - ใช้การเว้นบรรทัดและ Bullet points (-) เพื่อให้อ่านง่าย
                - ทำตัวหนาในจุดที่สำคัญ เช่น เบอร์โทร หรือชื่อเมนู

              คำถามจากผู้ใช้: "${userText}"
              คำตอบของคุณ:
            `;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

            try {
              const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 1,
                  }
                })
              });

              if (!geminiResponse.ok) {
                console.error(`[Gemini API Error] Status: ${geminiResponse.status}, Text: ${geminiResponse.statusText}`);
                if (geminiResponse.status === 429) {
                  aiReplyText = '⚠️ ขออภัยครับ ตอนนี้มีผู้ใช้งานสอบถามเข้ามาจำนวนมาก (ระบบ AI คิวเต็ม) รบกวนรอสัก 1-2 นาทีแล้วพิมพ์ถามใหม่อีกครั้งครับ';
                } else if (geminiResponse.status >= 500) {
                  aiReplyText = '⚠️ ขออภัยครับ ระบบประมวลผล AI ขัดข้องชั่วคราว รบกวนติดต่อ Service Desk โทร 9960 ครับ';
                } else {
                  aiReplyText = `⚠️ ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อ (Error ${geminiResponse.status})`;
                }
              } else {
                const geminiData: any = await geminiResponse.json();
                aiReplyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'ขออภัย ไม่สามารถประมวลผลคำตอบได้ในขณะนี้';
              }

            } catch (error) {
              console.error(`[System Error]`, error);
              aiReplyText = '⚠️ ขออภัยครับ ระบบเครือข่ายขัดข้อง ไม่สามารถประมวลผลคำตอบได้ รบกวนลองใหม่อีกครั้งครับ';
            }
        }

        // --- ส่วนที่ 4: ส่งคำตอบกลับไปที่ LINE ---
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            replyToken: replyToken,
            messages: [
              {
                type: 'text',
                text: aiReplyText
              }
            ]
          })
        });
      }
    }

    return new Response('OK', { status: 200 });
  },
} satisfies ExportedHandler<Env>;



