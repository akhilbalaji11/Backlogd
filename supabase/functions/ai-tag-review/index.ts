import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { review_text, game_title } = await req.json();

        if (!review_text || !game_title) {
            return new Response(
                JSON.stringify({ error: 'review_text and game_title are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const openaiKey = Deno.env.get('OPENAI_API_KEY');

        // ---- Layer 2: LLM tags (if key configured) ----
        if (openaiKey) {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a gaming review analyst. Given a review of a video game, return exactly 3 short descriptive tags (2-4 words each) that capture the essence of the review. Return ONLY a JSON array of strings, nothing else.',
                        },
                        {
                            role: 'user',
                            content: `Game: "${game_title}"\nReview: "${review_text.slice(0, 500)}"`,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 100,
                }),
            });

            if (res.ok) {
                const json = await res.json();
                const content = json.choices?.[0]?.message?.content ?? '[]';
                try {
                    const tags = JSON.parse(content);
                    if (Array.isArray(tags) && tags.length > 0) {
                        return new Response(
                            JSON.stringify({ tags: tags.slice(0, 3), source: 'llm' }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }
                } catch {
                    // fall through to deterministic
                }
            }
        }

        // ---- Layer 1: Deterministic fallback ----
        // Extract simple sentiment + length signals
        const text = review_text.toLowerCase();
        const tags: string[] = [];

        const sentimentMap: Array<[RegExp, string]> = [
            [/masterpiece|perfect|10\/10|flawless|must.?play/, 'Must-Play'],
            [/great|excellent|amazing|fantastic|love|loved/, 'Highly Recommended'],
            [/good|solid|enjoyable|fun|decent|worth/, 'Worth Playing'],
            [/okay|average|mediocre|mixed|meh/, 'Mixed Feelings'],
            [/bad|poor|disappoint|boring|waste|skip/, 'Skip It'],
            [/cozy|relax|chill|comfort/, 'Cozy Vibes'],
            [/challenge|hard|brutal|difficult|punishing/, 'Challenging'],
            [/story|narrative|plot|character|lore/, 'Great Story'],
            [/gameplay|mechanic|control|combat|system/, 'Tight Gameplay'],
            [/visual|graphic|art|beautiful|stunning/, 'Stunning Visuals'],
            [/music|soundtrack|audio|sound|ost/, 'Amazing OST'],
            [/short|brief|quick/, 'Short but Sweet'],
            [/long|epic|hundred.?hours?|40\+|60\+/, 'Epic Length'],
        ];

        for (const [pattern, tag] of sentimentMap) {
            if (pattern.test(text) && tags.length < 3) {
                tags.push(tag);
            }
        }

        // Pad to 3 if needed
        const fallbacks = ['Interesting Pick', 'Unique Experience', 'Memorable'];
        while (tags.length < 3) {
            tags.push(fallbacks[tags.length]);
        }

        return new Response(
            JSON.stringify({ tags: tags.slice(0, 3), source: 'deterministic' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        console.error('[ai-tag-review]', err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
