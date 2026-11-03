# Birthday AI Studio

Mini SaaS que transforma uma foto comum em um ensaio fotográfico de aniversário com IA (OpenAI).
O cliente vê a prévia grátis e paga **R$ 19,90** (Lastlink) para baixar a foto em alta resolução.
**Sem login, sem cadastro e sem banco de dados externo.**

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · OpenAI Images API (edição usando a foto como referência) · armazenamento em disco · Lastlink (checkout + webhook).

---

## Fluxo

1. `/criar`: o cliente envia a foto (arrastar ou galeria), escolhe a idade e o estilo (6 opções) e clica em gerar.
2. O backend valida a foto **pelo conteúdo**, remove EXIF/GPS, salva em pasta privada e processa em segundo plano.
3. A OpenAI (`images.edit`) recebe a **foto original como referência** e um prompt dinâmico (idade + estilo) que exige preservar a identidade.
4. `/ensaio/[id]`: tela de carregamento com mensagens e, em seguida, a **prévia** (640px com marca d'água). O arquivo em alta nunca sai antes do pagamento.
5. O cliente informa o e-mail e clica em **LIBERAR MINHA FOTO — R$ 19,90**. Isso abre o checkout da Lastlink.
6. A Lastlink chama `POST /api/webhooks/lastlink?token=…`. O backend valida o evento e vincula o pagamento ao ensaio.
7. A página detecta a confirmação e libera **BAIXAR MINHA FOTO** (JPG 1536x2304, sem marca d'água).

O visitante é identificado por um cookie anônimo HttpOnly, sem conta. Voltar da página de sucesso **não libera nada**: só o webhook autenticado libera.

---

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run build
npm start                    # http://localhost:3000
```

Durante o desenvolvimento use `npm run dev`. Sem `OPENAI_API_KEY`, o modo dev usa uma "IA" de demonstração gratuita.

### Onde os dados ficam

Tudo fica em `DATA_DIR` (padrão `./.data`):

- `db.json`: ensaios e pagamentos;
- `storage/`: fotos. Fica fora de `public/`, então só sai pelas rotas protegidas.

Arquivos com mais de `RETENTION_DAYS` dias (padrão 7) são apagados automaticamente, uma vez por hora.

### Hospedagem

O app precisa de **um processo Node com disco persistente**. Opções:

- **VPS** (Hostinger, DigitalOcean, Contabo…): `npm run build && npm start`, com PM2 e **uma única instância**, sem modo cluster.
- **Railway / Render / Fly.io**: crie um **volume** e aponte `DATA_DIR` para ele, por exemplo `/data`.

**Vercel não serve neste modo:** o disco das funções serverless é temporário e não é compartilhado entre requisições. Para usar a Vercel, seria preciso adicionar um armazenamento externo (Vercel Blob, Supabase etc.).

Coloque o site atrás de HTTPS, que é obrigatório para o cookie seguro e para o webhook.

---

## Variáveis (`.env.local`)

| Variável | Uso |
|---|---|
| `OPENAI_API_KEY` | chave da OpenAI (fica só no servidor) |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` (padrão). Alternativas: `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`, `gpt-image-1.5` |
| `OPENAI_IMAGE_SIZE` | `1536x2304` (padrão, retrato 2:3). No `gpt-image-1.5`, use `1024x1536` |
| `OPENAI_IMAGE_QUALITY` | `high` |
| `LASTLINK_CHECKOUT_URL` | link de checkout do produto de R$ 19,90 (padrão: `https://lastlink.com/p/C3AA92C82/checkout-payment/`) |
| `LASTLINK_WEBHOOK_TOKEN` | token aleatório longo, que vai na URL do webhook |
| `LASTLINK_APPROVED_EVENTS` / `LASTLINK_REFUND_EVENTS` | nomes exatos dos eventos (recomendado; veja abaixo) |
| `LASTLINK_PRODUCT_ID` | opcional: só libera eventos deste produto |
| `LASTLINK_ACCEPT_TEST_EVENTS` | `false` em produção |
| `SESSION_SECRET`, `CRON_SECRET` | strings aleatórias longas |
| `DATA_DIR` | pasta de dados (volume persistente) |
| `RETENTION_DAYS` | dias até excluir fotos e registros |
| `MAX_GENERATIONS_PER_IP_PER_DAY` / `..._PER_SESSION_PER_DAY` | limite de prévias grátis, porque cada geração custa na OpenAI |

Para gerar um token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Lastlink

1. O link de checkout do produto de R$ 19,90 já está configurado (`https://lastlink.com/p/C3AA92C82/checkout-payment/`). Para trocar, use `LASTLINK_CHECKOUT_URL`.
2. Cadastre o webhook com a URL `https://SEU-DOMINIO/api/webhooks/lastlink?token=SEU_LASTLINK_WEBHOOK_TOKEN`.
3. Se a Lastlink permitir uma página de obrigado, use `https://SEU-DOMINIO/obrigado`.
4. Envie um webhook de teste e procure no log do servidor a linha `[lastlink] evento recebido`. Copie o nome exato do evento de compra aprovada para `LASTLINK_APPROVED_EVENTS` e o de estorno para `LASTLINK_REFUND_EVENTS`.
5. Faça uma compra real de ponta a ponta antes de divulgar.

**Como o pagamento é associado ao ensaio.** O link de checkout leva `utm_content=<id do ensaio>`. Se a Lastlink devolver isso no webhook, o vínculo é direto. Se não devolver, o vínculo é feito pelo **e-mail** que o cliente digita antes de pagar, por isso a tela pede que ele use o mesmo e-mail. Cada pagamento libera um único ensaio.

O formato exato do payload da Lastlink não foi verificado. Por isso o parser ([`src/lib/lastlink.ts`](src/lib/lastlink.ts)) é tolerante e procura os campos em qualquer nível do JSON.

Proteções contra pagamento falso:

- token obrigatório;
- eventos de teste, pendentes e desconhecidos não liberam;
- reenvio do mesmo evento é ignorado (idempotência);
- estorno ou chargeback **revoga** o download.

---

## Testes

```bash
npm run typecheck
npm test            # unitários: parser do webhook e prompts
npm run test:e2e    # fluxo completo via HTTP contra o servidor rodando (ver cabeçalho do script)
```

Fotos da vitrine: `node --env-file=.env.local scripts/generate-examples.mjs` gera `public/examples/*.jpg`.
