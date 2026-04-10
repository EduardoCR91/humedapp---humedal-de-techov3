
/**
 * Servicio de IA para EcoBot usando Groq (modelos Llama 3.x) vía fetch.
 * La API key debe configurarse como: VITE_GROQ_API_KEY
 *
 * NOTA: Llamar a la API de Groq directamente desde el cliente expone la API key
 * en el bundle; es aceptable solo para demos/prototipos como este proyecto académico.
 */
const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

const CHAT_MODEL = "llama-3.1-8b-instant";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const getGeminiResponse = async (prompt: string, lang: "es" | "en") => {
  try {
    if (!apiKey) {
      console.error(
        "Groq API key is not configured. Set VITE_GROQ_API_KEY in your environment."
      );
      return lang === "en"
        ? "EcoBot is temporarily unavailable because the AI service is not configured."
        : "EcoBot está temporalmente no disponible porque el servicio de IA no está configurado.";
    }

    const languageLabel = lang === "en" ? "INGLÉS" : "ESPAÑOL";

    const systemPrompt = `Eres EcoBot, un asistente experto en el Humedal de Techo en Bogotá, Colombia.
Tu objetivo es educar, informar sobre la biodiversidad (como la Tingua Azul o el Cucarachero de Pantano)
y promover la protección ambiental.

Responde SIEMPRE en el idioma indicado (español o inglés) y con un formato muy claro y fácil de leer:
- Empieza con un TÍTULO corto en mayúsculas (máx. 6 palabras) en el idioma correcto.
- Luego da una EXPLICACIÓN BREVE de 2 a 3 frases sencillas.
- Después escribe de 3 a 5 PUNTOS CLAVE usando viñetas con el símbolo "•".
- Termina con una línea que empiece por "Recuerda:" o "Remember:" según el idioma, con una recomendación práctica para cuidar el humedal.

Evita párrafos largos, lenguaje muy técnico o respuestas desordenadas.
Si te preguntan algo fuera del contexto de humedales o Bogotá, responde muy brevemente y redirige la conversación hacia la importancia ecológica del humedal.`;

    const body = {
      model: CHAT_MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Idioma de respuesta: ${languageLabel}\n\nPregunta del usuario:\n${prompt}`,
        },
      ],
    };

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.error("Groq API HTTP error:", resp.status, await resp.text());
      return lang === "en"
        ? "EcoBot could not generate a response at this moment."
        : "EcoBot no pudo generar una respuesta en este momento.";
    }

    const data: any = await resp.json();
    const content: string =
      data.choices?.[0]?.message?.content?.toString().trim() ?? "";

    if (!content) {
      return lang === "en"
        ? "EcoBot could not generate a response at this moment."
        : "EcoBot no pudo generar una respuesta en este momento.";
    }

    return content;
  } catch (error) {
    console.error("Groq API Error:", error);
    return lang === "en"
      ? "Sorry, I had a problem processing your question."
      : "Lo siento, tuve un problema al procesar tu consulta.";
  }
};

/**
 * Aproxima el clima actual del Humedal de Techo usando el mismo modelo de Groq.
 * IMPORTANTE: no es un dato meteorológico oficial, solo una estimación orientativa.
 */
export const getWetlandWeather = async () => {
  try {
    if (!apiKey) {
      console.warn(
        "Weather service: Groq API key is not configured (VITE_GROQ_API_KEY)."
      );
      return null;
    }

    const weatherPrompt =
      "Proporciona una estimación razonable del clima actual en el Humedal de Techo, Bogotá: temperatura en °C, humedad en % y velocidad del viento en km/h. Responde únicamente en formato JSON con estas llaves: temp, humidity, wind. No agregues texto adicional.";

    const body = {
      model: CHAT_MODEL,
      temperature: 0.3,
      messages: [{ role: "user", content: weatherPrompt }],
    };

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.error("Groq weather HTTP error:", resp.status, await resp.text());
      return null;
    }

    const data: any = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const jsonStr = raw.toString().trim();

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return null;
  }
};
