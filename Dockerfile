# Image de l'intégration. Contraintes du bac à sable Gladys :
#   - rootfs en LECTURE SEULE -> ne jamais écrire hors de /data
#   - un seul volume inscriptible : /data
#   - tourne en utilisateur non-root
FROM node:24-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY index.js ./
COPY src ./src
COPY gladys-assistant-integration.json LICENSE ./

ENV NODE_ENV=production
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
