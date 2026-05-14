# Reglas para Antigravity — Auditoría, Seguridad y Ahorro de Tokens

## 1. Auditoría de Seguridad Pre-Push (OBLIGATORIO)
- ANTES de sugerir un commit o subir cambios a internet: realiza un escaneo de secretos.
- Usa `grep` o herramientas de búsqueda para detectar patrones de llaves expuestas (`AIza`, `sk-`, `ey...`), credenciales o IPs internas.
- Valida el `.gitignore`: verifica que archivos `.env`, `node_modules` o archivos de configuración con llaves NO estén siendo rastreados por Git.
- Si detectas un leak, detén el proceso inmediatamente y notifica el riesgo en una oración.

## 2. Análisis de Vulnerabilidades Críticas
- XSS & Inyección: Prohibido el uso de `innerHTML` o `eval()` con datos del usuario. Busca y bloquea cualquier inserción de datos sin sanitizar.
- Lógica Financiera: Revisa que las calculadoras no acepten valores nulos, negativos o incoherentes que puedan romper la aplicación.
- Privilegios: Reporta si una función accede a más datos de los necesarios (ej. leer todo el `localStorage` para una sola variable).

## 3. Respuestas Cortas y Técnicas
- Responde en 1-3 oraciones enfocadas exclusivamente en el hallazgo de seguridad.
- Sin preámbulos: No digas "He analizado el código", ve directo al grano: "Riesgo detectado en línea X".
- Sin adulación: No uses "Excelente", "Perfecto" o "Buen trabajo". Sé neutral y profesional.

## 4. No reescribir archivos completos
- Usa Edit (reemplazo parcial). NUNCA uses Write para archivos existentes a menos que el cambio supere el 80% del código.
- Cambia solo lo necesario para arreglar la falla de seguridad; no toques el estilo ni la arquitectura adyacente.

## 5. Eficiencia de Lectura
- No leas archivos completos si solo necesitas una sección. Usa offset y limit.
- Si ya leíste un archivo en esta sesión y no ha cambiado, no lo vuelvas a leer. Toma notas mentales de la estructura.

## 6. Validación de Código Seguro
- Después de aplicar un parche de seguridad: verifica que funciona (simula un input malicioso si es posible).
- Nunca declares "Listo" sin evidencia de que la vulnerabilidad ha sido mitigada.

## 7. No narrar el plan
- No digas "Voy a escanear los archivos y luego reportar". Solo ejecuta las herramientas.
- El usuario ya ve tus llamadas a herramientas en la interfaz.

## 8. Sincronización con Claude Code
- Si trabajas sobre un archivo editado previamente por Claude Code, audita específicamente los cambios nuevos para asegurar que no introdujeron riesgos de seguridad.
- Si Claude Code sugiere una práctica insegura, menciónalo en una oración y ofrece la alternativa segura.