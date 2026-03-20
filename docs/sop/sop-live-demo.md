# Sketch 2 Reality — Standard Operating Procedure (SOP)
# Live Palestra Demo Flow

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-03-20 | Orion / @pm |

---

## Objetivo

Procedimento operacional para executar a demonstracao "Sketch 2 Reality" durante palestras ao vivo. Uma pessoa da audiencia desenha um website no papel, o apresentador tira uma foto, faz upload, e o sistema automaticamente gera um website profissional branded e faz deploy com URL acessivel em tempo real.

---

## Pre-Requisitos

### Hardware
- [ ] Laptop com internet estavel (WiFi ou 4G/5G hotspot como backup)
- [ ] Camera do celular ou webcam para fotografar o sketch
- [ ] Projetor/tela conectado ao laptop (1920x1080 minimo)
- [ ] Papel A4 e caneta/marcador grosso (preto) para o voluntario desenhar
- [ ] Opcional: iPad com Apple Pencil como alternativa digital

### Software
- [ ] Node.js 18+ instalado
- [ ] Servidor Sketch 2 Reality rodando (`npm run dev` ou `node src/server.js`)
- [ ] Google Stitch API key configurada e validada
- [ ] Vercel CLI autenticado ou API token configurado
- [ ] Projeto Vercel pre-configurado com subdomain pattern
- [ ] Browser aberto em tela cheia no `http://localhost:3333`

### Pre-Show Checklist (30 min antes)
- [ ] Iniciar servidor: `cd aiox-sketch2reality && npm run dev`
- [ ] Abrir browser → `http://localhost:3333`
- [ ] Verificar status bar: "CONNECTED TO STITCH" com bolinha verde
- [ ] Fazer um teste completo com sketch de exemplo (validar pipeline inteiro)
- [ ] Confirmar que o deploy Vercel funcionou e URL esta acessivel
- [ ] Fechar todas as outras abas e notificacoes do laptop
- [ ] Ajustar brilho da tela para maximo (projecao)
- [ ] Desativar screensaver e sleep mode
- [ ] Ter backup do sketch de exemplo caso o voluntario demore muito

---

## Fluxo da Demonstracao

### Fase 1: Setup (1-2 minutos)

**O que dizer:**
> "Vou mostrar algo que mistura inteligencia artificial com criatividade humana. Preciso de um voluntario da plateia que saiba desenhar... na verdade, que NAO saiba desenhar. Quanto pior o desenho, melhor o resultado."

**Acoes:**
1. Convidar uma pessoa da audiencia ao palco
2. Entregar papel A4 e caneta/marcador GROSSO (importante: linhas finas nao escaneiam bem)
3. Instruir: "Desenhe a homepage de um website. Pode ter logo, menu, titulo, botoes, imagens... qualquer coisa. Voce tem 60 segundos."

**Dicas:**
- Use marcador grosso preto — linhas finas ficam ruins na foto
- Se possivel, use uma mesa com fundo claro/branco
- Deixar a audiencia ver o processo (camera do documento ou celular na tela)

---

### Fase 2: Captura (30 segundos)

**O que dizer:**
> "Perfeito! Agora vou tirar uma foto desse sketch e enviar para nossa inteligencia artificial."

**Acoes:**
1. Fotografar o sketch com celular
   - Enquadrar bem, sem sombras
   - Fundo claro, boa iluminacao
   - Foto de cima para baixo (bird's eye view)
2. Enviar foto para o laptop (AirDrop, email, ou USB)
3. No browser, clicar "BROWSE FILES" ou arrastar a foto para a zona de upload
4. Verificar que o preview da imagem aparece no painel esquerdo

**Plano B:** Se a transferencia demorar, usar o sketch de exemplo pre-preparado

---

### Fase 3: Geracao (60-90 segundos)

**O que dizer:**
> "Agora a AI vai analisar esse desenho, entender a estrutura, aplicar o branding da Future Foundation, e gerar um website profissional. Em tempo real."

**Acoes:**
1. Clicar "GENERATE WEBSITE"
2. O overlay de loading aparece com os passos animados:
   - "ANALYZING SKETCH LAYOUT..."
   - "APPLYING FUTURE FOUNDATION BRANDING..."
   - "GENERATING WEBSITE CODE..."
   - "DEPLOYING TO VERCEL..."
   - "WEBSITE IS LIVE!"
3. Enquanto processa, narrar o que esta acontecendo:
   > "A AI esta interpretando cada elemento do desenho — onde esta o menu, o titulo, as imagens. Agora esta aplicando nossas cores, fontes, e identidade visual..."

**Timing:** ~60-90 segundos. Use esse tempo para engagement com a plateia.

---

### Fase 4: Revelacao — O Momento UAU (imediato)

**O que dizer:**
> "E aqui esta. De um desenho no papel... para um website profissional. Navegavel. Ja no ar."

**Acoes:**
1. O website aparece no painel direito (iframe preview)
2. A URL deployada aparece abaixo do preview
3. O QR code aparece automaticamente
4. Fazer pausa dramatica — deixar a audiencia processar
5. Mostrar o URL: "Esse site JA esta no ar. Voces podem acessar agora mesmo."
6. Mostrar o QR code: "Apontem o celular aqui."

**Momento chave:** A pausa entre o resultado aparecer e voce falar e CRITICA. Deixe o visual falar sozinho por 3-5 segundos.

---

### Fase 5: Variantes — Triple UAU (opcional, +60 segundos)

**O que dizer:**
> "Mas e se eu quiser explorar outras interpretacoes desse mesmo sketch?"

**Acoes:**
1. Clicar "GENERATE VARIANTS"
2. O sistema gera 3 versoes completamente diferentes:
   - Cada uma reimagina o layout com estilos distintos
   - Todas mantem o branding Future Foundation
3. Mostrar as 3 variantes lado a lado
4. Selecionar uma e fazer deploy

**O que dizer ao mostrar:**
> "3 interpretacoes completamente diferentes. Mesma marca, mesma identidade, mas cada uma com uma personalidade unica. E cada uma pode ser deployada em segundos."

---

### Fase 6: Encerramento (1 minuto)

**O que dizer:**
> "Do papel ao ar em menos de 2 minutos. Isso e o que inteligencia artificial faz quando combinada com design thinking e estrategia. Nao substitui o designer — amplifica a criatividade humana."

**Acoes:**
1. Agradecer o voluntario
2. Deixar o QR code na tela para audiencia acessar
3. Opcional: mostrar o website no celular (provar que e real)

---

## Troubleshooting

### Problema: "DISCONNECTED" na status bar
**Solucao:** Verificar internet. Reiniciar servidor (`Ctrl+C` → `npm run dev`). Verificar API key.

### Problema: Geracao demora mais de 2 minutos
**Solucao:** Interagir com a plateia. "A AI esta trabalhando duro..." Se passar de 3 min, usar resultado pre-gerado como backup.

### Problema: Stitch retorna erro/tela vazia
**Solucao:** Clicar CLEAR, recarregar a foto, tentar novamente. Se persistir, trocar modelo de GEMINI_3_FLASH para GEMINI_3_PRO no device toggle.

### Problema: Vercel deploy falha
**Solucao:** O preview no iframe ainda funciona. Mostrar o preview local. Explicar: "O site esta gerado, o deploy leva mais alguns segundos."

### Problema: Foto do sketch fica escura/ilegivel
**Solucao:** Pedir para tirar outra foto com flash. Ou usar o sketch backup pre-preparado.

### Problema: Internet cai durante a demo
**Solucao:** Ter hotspot 4G/5G como backup. Alternar para rede do celular. Worst case: mostrar video gravado do fluxo completo.

---

## Backup Plan

**SEMPRE ter preparado:**
1. Sketch de exemplo pre-fotografado no laptop
2. Resultado pre-gerado como backup (screenshot + HTML)
3. Video gravado do fluxo completo (para caso de falha total)
4. Hotspot 4G/5G como backup de internet

---

## Tempo Total Estimado

| Fase | Tempo |
|------|-------|
| Setup + Voluntario | 1-2 min |
| Desenho | 1 min |
| Captura + Upload | 30 seg |
| Geracao | 60-90 seg |
| Revelacao | 30 seg |
| Variantes (opcional) | 60 seg |
| Encerramento | 1 min |
| **TOTAL** | **5-7 min** |

---

## Notas para o Apresentador

- **Confianca:** Teste MULTIPLAS vezes antes da palestra. Familiarize-se com cada passo.
- **Narrativa:** O sketch NAO precisa ser bom. Sketches ruins geram resultados impressionantes (maior contraste = maior UAU).
- **Timing:** A pausa apos a revelacao e mais importante que qualquer palavra. Deixe o visual impactar.
- **Backup:** Sempre tenha o plano B pronto. Ninguem na plateia sabe qual era o resultado "esperado".
- **Energia:** O momento da revelacao precisa de sua reacao genuina. Mesmo que voce ja tenha visto 100 vezes, reaja como se fosse a primeira.
