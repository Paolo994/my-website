# Pubblicare il sito su una VPS

Guida passo passo per mettere online il sito con HTTPS su un server tuo.
Tempo stimato: circa un'ora la prima volta.

```
Internet ──443/80──▶ Caddy (HTTPS automatico, header di sicurezza) ──▶ site:8787 (Spring Boot + sito)
                                                                         └── assets/cv montata dal server
```

Solo Caddy è raggiungibile da Internet; il container del sito resta interno.

## Cosa ti serve

- **Una VPS** con Ubuntu 24.04 e almeno 2 GB di RAM in un data center UE. Configurazione usata: **DigitalOcean,
  Droplet Basic 2 GB / 1 vCPU, Amsterdam** (a novembre 2026 i piani economici di Hetzner e OVH risultavano esauriti).
- **Un dominio** (per esempio `paolociotta.dev`), da qualsiasi registrar.
- **La chiave Anthropic** e il **PDF del CV** sul tuo PC.

## 1. Crea la VPS

1. Crea il server con **Ubuntu 24.04** e aggiungi la tua **chiave SSH** (evita l'accesso con password).
2. Annota l'indirizzo IP pubblico (IPv4, e IPv6 se c'è).
3. Collegati: `ssh root@IP_DEL_SERVER`

## 2. Prepara il server

```bash
# aggiornamenti, anche automatici
apt update && apt upgrade -y
apt install -y unattended-upgrades git ufw
dpkg-reconfigure -plow unattended-upgrades

# firewall: solo SSH, HTTP e HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable

# Docker (script ufficiale)
curl -fsSL https://get.docker.com | sh

# 2 GB di swap: margine di sicurezza per la compilazione Java su server con poca RAM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# utente dedicato invece di root
adduser --disabled-password --gecos "" paolo
usermod -aG docker paolo
mkdir -p /home/paolo/.ssh && cp ~/.ssh/authorized_keys /home/paolo/.ssh/
chown -R paolo:paolo /home/paolo/.ssh
```

Da qui in poi collegati come `ssh paolo@IP_DEL_SERVER`.

## 3. Punta il dominio sul server

Nel pannello DNS del registrar crea:

| Tipo | Nome | Valore |
|---|---|---|
| A | `@` | IPv4 del server |
| A | `www` | IPv4 del server |
| AAAA | `@` e `www` | IPv6 del server (se c'è) |

Verifica con `ping tuodominio.dev`: deve rispondere l'IP del server. Possono servire alcuni minuti.

## 4. Scarica il progetto e configura

```bash
git clone https://github.com/Paolo994/my-website.git
cd my-website
cp .env.example .env
nano .env
```

Nel file `.env` imposta almeno:

```
DOMAIN=tuodominio.dev
ANTHROPIC_API_KEY=sk-ant-...
```

Proteggi il file: `chmod 600 .env`.

Dal **tuo PC** copia il CV sul server (in PowerShell):

```powershell
scp assets\cv\Paolo_Ciotta_CV_EN.pdf paolo@IP_DEL_SERVER:~/my-website/assets/cv/
```

## 5. Avvia

```bash
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml logs -f
```

Al primo avvio Caddy ottiene il certificato HTTPS (pochi secondi; serve che il DNS punti già al server).
Apri `https://tuodominio.dev`: deve comparire il sito con il lucchetto.

Controlli rapidi:

```bash
curl -s https://tuodominio.dev/api/assistant     # {"enabled":true,...}
curl -sI http://tuodominio.dev | head -1         # 308: redirect verso https
```

## 6. Dopo il primo deploy

- **Anteprima dei link** (LinkedIn, email): in `index.html` cambia
  `<meta property="og:image" content="assets/img/og.jpg">` in
  `content="https://tuodominio.dev/assets/img/og.jpg"` e aggiungi
  `<meta property="og:url" content="https://tuodominio.dev/">`. Poi commit, push e aggiorna (punto 7).
  Puoi controllare il risultato con il Post Inspector di LinkedIn.
- **Limite di spesa** nella console Anthropic: una rete di sicurezza oltre ai limiti del backend.
- **Prova la chat** con qualche domanda e una "difficile" (stipendio, telefono, istruzioni strane).

## 7. Operazioni di tutti i giorni

| Cosa | Come |
|---|---|
| Pubblicare modifiche al codice | `git pull && docker compose -f compose.prod.yml up -d --build` |
| Cambiare il CV | `scp` del nuovo PDF con lo stesso nome: download e assistente lo usano subito, niente riavvio |
| Cambiare impostazioni (`.env`) | `docker compose -f compose.prod.yml up -d` |
| Spegnere o accendere l'AI | `ASSISTANT_ENABLED=false` o `true` in `.env`, poi il comando sopra |
| Aggiornare subito i progetti GitHub | `docker compose -f compose.prod.yml restart site` |
| Vedere i log | `docker compose -f compose.prod.yml logs -f site` |
| Fare pulizia delle immagini vecchie | `docker image prune -f` |

## Cosa è già configurato

- **HTTPS** con certificati Let's Encrypt rinnovati automaticamente; `http` e `www` reindirizzano a `https://tuodominio.dev`.
- **Header di sicurezza**: HSTS, Content-Security-Policy (il browser carica solo risorse del sito), anti-iframe,
  nessuna intestazione `Server`.
- **Privacy**: nessun cookie; Caddy non salva log di accesso; i log dell'app non contengono IP né testi delle domande
  e ruotano a 30 MB; i font sono serviti dal sito, non da Google. Informativa in `privacy.html`.
- **Isolamento**: il container dell'app non espone porte; l'API accetta richieste solo dal tuo dominio.
- **Riavvio automatico** dei container se il server si riavvia.

## Se qualcosa non va

| Sintomo | Causa probabile |
|---|---|
| Nessun certificato, errore HTTPS | Il DNS non punta ancora al server, oppure le porte 80/443 sono chiuse nel firewall (anche nel pannello del provider) |
| Il pulsante della chat non compare | `ANTHROPIC_API_KEY` vuota o `ASSISTANT_ENABLED=false`: controlla `.env` e i log |
| "Scarica CV" dà 404 | Il PDF non è in `~/my-website/assets/cv/` o ha un nome diverso |
| La chat dice "offline" | `docker compose -f compose.prod.yml ps`: il container `site` deve essere `healthy` |
