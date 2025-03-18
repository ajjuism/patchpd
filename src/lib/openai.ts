import OpenAI from 'openai';

export async function generatePdPatch(prompt: string, errorFeedback?: string, retryCount = 0): Promise<{ patch: string; explanation: string }> {
  const apiKey = localStorage.getItem('openai_api_key');
  
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  if (!apiKey.startsWith('sk-')) {
    throw new Error('API_KEY_INVALID');
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });

  try {
    // Add timeout to OpenAI call
    const completion = await Promise.race([
      openai.chat.completions.create({
        messages: [
          {
            role: "system" as const,
            content: `You are an expert in Pure Data (Pd) programming. Generate functional audio patches with clear instructions. Your response MUST follow this EXACT format and include ALL components:

---PATCH---
#N canvas 0 0 520 400;
#X obj 10 10 cnv 15 500 60 empty empty FM Synthesizer 20 12 0 14 -233017 -66577 0;
#X text 20 30 Instructions: 1) Click START 2) Adjust frequency 3) Control volume;
#X obj 50 100 loadbang;
#X msg 50 120 1;
#X obj 50 140 tgl 15 0 empty empty START 17 7 0 10 -262144 -1 -1 0 1;
#X obj 50 160 metro 100;
#X obj 50 200 osc~ 440;
#X obj 50 250 *~ 0.5;
#X obj 50 300 clip~ -1 1;
#X obj 50 350 dac~;
#X obj 150 300 vu 15 120 empty empty -1 -8 0 10 -66577 -1 1;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 5 0 6 0;
#X connect 6 0 7 0;
#X connect 7 0 8 0;
#X connect 8 0 9 0;
#X connect 8 0 10 0;

CRITICAL REQUIREMENTS:
1. EVERY audio object (ending in ~) MUST be connected in sequence
2. ALL connections MUST be explicitly listed with #X connect
3. Audio chain MUST flow: source~ -> processing~ -> volume~ -> clip~ -> dac~
4. Control flow MUST be: loadbang -> msg 1 -> tgl -> metro -> audio
5. Volume control MUST be 0.5 or less for safety
6. Instructions MUST be visible in the patch

---EXPLANATION---
Step-by-step explanation of the patch...`,
          },
          {
            role: "user" as const,
            content: prompt
          },
          ...(errorFeedback ? [{
            role: "user" as const,
            content: `Errors to fix: ${errorFeedback}`
          }] : [])
        ],
        model: "gpt-4",
        temperature: 0.7, // Add some variation but keep it focused
        max_tokens: 2000, // Limit response size
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timeout')), 30000)
      )
    ]);

    const content = completion.choices[0].message.content || '';
    const parts = content.split(/---PATCH---|---EXPLANATION---/);
    
    const patch = parts[1]?.replace(/```pd\n?|\n?```/g, '') || '';
    const explanation = parts[2] || '';

    // Quick validation without regeneration
    const validation = {
      hasStartToggle: patch.includes('tgl 15 0') && patch.includes('START'),
      hasDac: patch.includes('dac~'),
      hasVolumeControl: patch.includes('*~ 0.5') || patch.includes('*~ 0.25'),
      hasVuMeter: patch.includes('vu 15 120'),
      hasInstructions: patch.includes('cnv 15') && patch.includes('text'),
      hasLoadBang: patch.includes('loadbang'),
      hasMetro: patch.includes('metro'),
      hasConnections: patch.includes('#X connect'),
      // Check for complete audio chain
      hasAudioChain: (
        patch.includes('osc~') || patch.includes('phasor~') || patch.includes('noise~')
      ) && patch.includes('*~') && patch.includes('clip~') && patch.includes('dac~'),
      // Verify connections exist
      hasProperConnections: (() => {
        const connections = patch.match(/#X connect \d+ \d+/g) || [];
        return connections.length >= 6; // Minimum number of required connections
      })(),
      // Check for volume safety
      hasSafeVolume: patch.includes('*~ 0.5') || patch.includes('*~ 0.25') || patch.includes('*~ 0.1'),
    };

    // If missing components and haven't retried too many times
    if (retryCount < 2 && Object.values(validation).some(v => !v)) {
      const missingComponents = Object.entries(validation)
        .filter(([, exists]) => !exists)
        .map(([component]) => component.replace('has', ''))
        .join(', ');

      console.warn(`Retry ${retryCount + 1}: Missing components: ${missingComponents}`);
      return generatePdPatch(
        prompt,
        `Please include missing components: ${missingComponents}`,
        retryCount + 1
      );
    }

    // Return what we have after retries or if validation passes
    return {
      patch: patch.trim(),
      explanation: explanation.trim()
    };

  } catch (error: any) {
    // Handle specific OpenAI API errors
    if (error.message === 'API_KEY_MISSING') {
      throw new Error('Please set your OpenAI API key in the settings to generate patches');
    }
    if (error.message === 'API_KEY_INVALID') {
      throw new Error('Invalid API key format. Please check your OpenAI API key');
    }
    if (error.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key in settings');
    }
    if (error.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later');
    }
    // Re-throw other errors
    throw error;
  }
}