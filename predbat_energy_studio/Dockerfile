FROM node:22-alpine
ARG BUILD_ARCH
ARG BUILD_VERSION="0.1.2"
LABEL io.hass.type="app" \
      io.hass.version="${BUILD_VERSION}" \
      io.hass.arch="${BUILD_ARCH}"
WORKDIR /app
COPY --chown=node:node server.mjs startup.mjs source.mjs package.json ./
COPY --chown=node:node public ./public
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8099
EXPOSE 8099
CMD ["node", "startup.mjs"]
